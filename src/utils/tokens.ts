import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface AccessTokenPayload {
  sub: string;
  purpose: "access";
}

export interface TwoFactorTokenPayload {
  sub: string;
  purpose: "2fa";
}

function sign(payload: AccessTokenPayload | TwoFactorTokenPayload, expiresIn: string): string {
  const options: jwt.SignOptions = { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] };
  return jwt.sign(payload, env.jwtAccessSecret, options);
}

export function signAccessToken(userId: string): string {
  return sign({ sub: userId, purpose: "access" }, env.accessTokenTtl);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
  if (payload.purpose !== "access") {
    throw new Error("Not an access token");
  }
  return payload;
}

export function signTwoFactorToken(userId: string): string {
  return sign({ sub: userId, purpose: "2fa" }, "5m");
}

export function verifyTwoFactorToken(token: string): TwoFactorTokenPayload {
  const payload = jwt.verify(token, env.jwtAccessSecret) as TwoFactorTokenPayload;
  if (payload.purpose !== "2fa") {
    throw new Error("Not a two-factor token");
  }
  return payload;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  const days = env.refreshTokenTtlDays;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
