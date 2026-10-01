import { prisma } from "../config/prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiryDate,
  signAccessToken,
  signTwoFactorToken,
  verifyTwoFactorToken,
} from "../utils/tokens";
import { HttpError } from "../middleware/errorHandler";
import { logSecurityEvent } from "./securityEvent.service";
import { verifyLoginCode } from "./twoFactor.service";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

type LoginResult = { twoFactorRequired: true; twoFactorToken: string } | ({ twoFactorRequired: false } & TokenPair);

async function issueTokenPair(userId: string): Promise<TokenPair> {
  const accessToken = signAccessToken(userId);
  const refreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshTokenExpiryDate(),
    },
  });

  return { accessToken, refreshToken };
}

export async function register(email: string, password: string, ip?: string): Promise<TokenPair> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  await logSecurityEvent({ type: "REGISTER", userId: user.id, email, ip });

  return issueTokenPair(user.id);
}

export async function login(email: string, password: string, ip?: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await verifyPassword(
      "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      password,
    ).catch(() => undefined);
    await logSecurityEvent({ type: "LOGIN_FAILURE", email, ip });
    throw new HttpError(401, "Invalid email or password");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, "Account temporarily locked due to repeated failed logins");
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock ? new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS) : null,
      },
    });

    await logSecurityEvent({
      type: shouldLock ? "ACCOUNT_LOCKED" : "LOGIN_FAILURE",
      userId: user.id,
      email,
      ip,
    });

    throw new HttpError(401, "Invalid email or password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  if (user.totpEnabled) {
    return { twoFactorRequired: true, twoFactorToken: signTwoFactorToken(user.id) };
  }

  await logSecurityEvent({ type: "LOGIN_SUCCESS", userId: user.id, email, ip });
  const tokens = await issueTokenPair(user.id);

  return { twoFactorRequired: false, ...tokens };
}

export async function completeTwoFactorLogin(
  twoFactorToken: string,
  code: string,
  ip?: string,
): Promise<TokenPair> {
  let userId: string;
  try {
    userId = verifyTwoFactorToken(twoFactorToken).sub;
  } catch {
    throw new HttpError(401, "Invalid or expired two-factor challenge");
  }

  const valid = await verifyLoginCode(userId, code, ip);
  if (!valid) {
    throw new HttpError(401, "Invalid two-factor code");
  }

  await logSecurityEvent({ type: "LOGIN_SUCCESS", userId, ip });
  return issueTokenPair(userId);
}

export async function refresh(presentedToken: string, ip?: string): Promise<TokenPair> {
  const tokenHash = hashRefreshToken(presentedToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  if (stored.revokedAt) {
    await logSecurityEvent({ type: "REFRESH_TOKEN_REUSE", userId: stored.userId, ip });
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  if (stored.expiresAt < new Date()) {
    throw new HttpError(401, "Invalid or expired refresh token");
  }

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  return issueTokenPair(stored.userId);
}

export async function logout(presentedToken: string, ip?: string): Promise<void> {
  const tokenHash = hashRefreshToken(presentedToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (stored) {
    await logSecurityEvent({ type: "LOGOUT", userId: stored.userId, ip });
  }
}
