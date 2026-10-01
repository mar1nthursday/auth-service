import { afterAll, describe, expect, it } from "vitest";
import { authenticator } from "otplib";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { TEST_PASSWORD, uniqueEmail } from "./helpers";

const app = createApp();

async function registerAndLogin() {
  const email = uniqueEmail();
  const registerRes = await request(app)
    .post("/auth/register")
    .send({ email, password: TEST_PASSWORD });
  return { email, accessToken: registerRes.body.accessToken as string };
}

async function enrollTwoFactor(accessToken: string) {
  const setupRes = await request(app)
    .post("/auth/2fa/setup")
    .set("Authorization", `Bearer ${accessToken}`);
  const secret = setupRes.body.secret as string;

  const enableRes = await request(app)
    .post("/auth/2fa/enable")
    .set("Authorization", `Bearer ${accessToken}`)
    .send({ code: authenticator.generate(secret) });

  expect(enableRes.status).toBe(204);
  return secret;
}

afterAll(async () => {
  await prisma.securityEvent.deleteMany({ where: { email: { startsWith: "test-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "test-" } } });
  await prisma.$disconnect();
});

describe("POST /auth/2fa/setup", () => {
  it("rejects a request with no access token", async () => {
    const res = await request(app).post("/auth/2fa/setup");
    expect(res.status).toBe(401);
  });

  it("returns a TOTP secret and otpauth URL for an authenticated user", async () => {
    const { accessToken } = await registerAndLogin();
    const res = await request(app)
      .post("/auth/2fa/setup")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.secret).toEqual(expect.any(String));
    expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
  });
});

describe("POST /auth/2fa/enable", () => {
  it("rejects an incorrect code", async () => {
    const { accessToken } = await registerAndLogin();
    await request(app).post("/auth/2fa/setup").set("Authorization", `Bearer ${accessToken}`);

    const res = await request(app)
      .post("/auth/2fa/enable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code: "000000" });

    expect(res.status).toBe(400);
  });

  it("enables 2FA given a valid code", async () => {
    const { accessToken } = await registerAndLogin();
    await enrollTwoFactor(accessToken);

    const meRes = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(meRes.body.totpEnabled).toBe(true);
  });
});

describe("login with 2FA enabled", () => {
  it("requires a second step instead of returning tokens directly", async () => {
    const { email, accessToken } = await registerAndLogin();
    await enrollTwoFactor(accessToken);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email, password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.twoFactorRequired).toBe(true);
    expect(loginRes.body.twoFactorToken).toEqual(expect.any(String));
    expect(loginRes.body.accessToken).toBeUndefined();
    expect(loginRes.headers["set-cookie"]).toBeUndefined();
  });

  it("rejects an incorrect TOTP code at the verify step", async () => {
    const { email, accessToken } = await registerAndLogin();
    await enrollTwoFactor(accessToken);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email, password: TEST_PASSWORD });

    const verifyRes = await request(app)
      .post("/auth/2fa/verify")
      .send({ twoFactorToken: loginRes.body.twoFactorToken, code: "000000" });

    expect(verifyRes.status).toBe(401);
  });

  it("issues tokens when the correct TOTP code is presented", async () => {
    const { email, accessToken } = await registerAndLogin();
    const secret = await enrollTwoFactor(accessToken);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email, password: TEST_PASSWORD });

    const verifyRes = await request(app)
      .post("/auth/2fa/verify")
      .send({ twoFactorToken: loginRes.body.twoFactorToken, code: authenticator.generate(secret) });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.accessToken).toEqual(expect.any(String));
    expect(verifyRes.headers["set-cookie"]?.[0]).toMatch(/refreshToken=/);
  });

  it("does not accept the pending two-factor token as a regular access token", async () => {
    const { email, accessToken } = await registerAndLogin();
    await enrollTwoFactor(accessToken);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email, password: TEST_PASSWORD });

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.twoFactorToken}`);

    expect(res.status).toBe(401);
  });
});

describe("POST /auth/2fa/disable", () => {
  it("disables 2FA given a valid code, restoring normal single-step login", async () => {
    const { email, accessToken } = await registerAndLogin();
    const secret = await enrollTwoFactor(accessToken);

    const disableRes = await request(app)
      .post("/auth/2fa/disable")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ code: authenticator.generate(secret) });

    expect(disableRes.status).toBe(204);

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email, password: TEST_PASSWORD });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.twoFactorRequired).toBeUndefined();
    expect(loginRes.body.accessToken).toEqual(expect.any(String));
  });
});
