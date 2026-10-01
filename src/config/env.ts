import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const totpEncryptionKey = required("TOTP_ENCRYPTION_KEY");
if (!/^[0-9a-f]{64}$/i.test(totpEncryptionKey)) {
  throw new Error("TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
  totpEncryptionKey,
  totpIssuer: process.env.TOTP_ISSUER ?? "auth-service",
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
};
