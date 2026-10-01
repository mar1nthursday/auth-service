import crypto from "node:crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { hashPassword } from "../utils/password";
import { HttpError } from "../middleware/errorHandler";
import { logSecurityEvent } from "./securityEvent.service";
import { sendPasswordResetEmail } from "./mailer.service";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function requestReset(email: string, ip?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  await logSecurityEvent({ type: "PASSWORD_RESET_REQUESTED", userId: user.id, email, ip });

  const resetUrl = `${env.appUrl}/reset-password?token=${rawToken}`;
  sendPasswordResetEmail(email, resetUrl);
}

export async function confirmReset(rawToken: string, newPassword: string, ip?: string): Promise<void> {
  const tokenHash = hashResetToken(rawToken);
  const stored = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
    throw new HttpError(400, "Invalid or expired reset token");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    }),
    prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logSecurityEvent({ type: "PASSWORD_RESET_COMPLETED", userId: stored.userId, ip });
}
