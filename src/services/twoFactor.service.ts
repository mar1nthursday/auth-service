import { authenticator } from "otplib";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { decrypt, encrypt } from "../utils/crypto";
import { HttpError } from "../middleware/errorHandler";
import { logSecurityEvent } from "./securityEvent.service";

interface SetupResult {
  secret: string;
  otpauthUrl: string;
}

export async function setup(userId: string, email: string): Promise<SetupResult> {
  const secret = authenticator.generateSecret();
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: encrypt(secret), totpEnabled: false },
  });

  return {
    secret,
    otpauthUrl: authenticator.keyuri(email, env.totpIssuer, secret),
  };
}

async function verifyCodeForUser(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpSecret) return false;
  return authenticator.check(code, decrypt(user.totpSecret));
}

export async function enable(userId: string, code: string, ip?: string): Promise<void> {
  const valid = await verifyCodeForUser(userId, code);
  if (!valid) {
    throw new HttpError(400, "Invalid two-factor code");
  }

  await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
  await logSecurityEvent({ type: "TWO_FACTOR_ENABLED", userId, ip });
}

export async function disable(userId: string, code: string, ip?: string): Promise<void> {
  const valid = await verifyCodeForUser(userId, code);
  if (!valid) {
    throw new HttpError(400, "Invalid two-factor code");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: false, totpSecret: null },
  });
  await logSecurityEvent({ type: "TWO_FACTOR_DISABLED", userId, ip });
}

export async function verifyLoginCode(userId: string, code: string, ip?: string): Promise<boolean> {
  const valid = await verifyCodeForUser(userId, code);
  if (!valid) {
    await logSecurityEvent({ type: "TWO_FACTOR_FAILURE", userId, ip });
  }
  return valid;
}
