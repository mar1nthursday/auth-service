import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { TEST_PASSWORD, extractCookie, uniqueEmail } from "./helpers";

const app = createApp();

beforeAll(() => {
  process.env.NODE_ENV = "test";
});

afterAll(async () => {
  await prisma.securityEvent.deleteMany({ where: { email: { startsWith: "test-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "test-" } } });
  await prisma.$disconnect();
});

describe("POST /auth/register", () => {
  it("creates a new account and returns an access token plus a refresh cookie", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: uniqueEmail(), password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(extractCookie(res, "refreshToken")).toMatch(/^refreshToken=.+/);
  });

  it("rejects a duplicate email", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: TEST_PASSWORD });

    const res = await request(app).post("/auth/register").send({ email, password: TEST_PASSWORD });

    expect(res.status).toBe(409);
  });

  it("rejects a password shorter than 12 characters", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: uniqueEmail(), password: "short" });

    expect(res.status).toBe(400);
  });

  it("rejects an invalid email", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "not-an-email", password: TEST_PASSWORD });

    expect(res.status).toBe(400);
  });
});

describe("POST /auth/login", () => {
  it("logs in with correct credentials", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: TEST_PASSWORD });

    const res = await request(app).post("/auth/login").send({ email, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it("rejects a wrong password", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: TEST_PASSWORD });

    const res = await request(app)
      .post("/auth/login")
      .send({ email, password: "WrongPassword123!" });

    expect(res.status).toBe(401);
  });

  it("rejects an unknown email", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: uniqueEmail(), password: TEST_PASSWORD });

    expect(res.status).toBe(401);
  });

  it("locks the account for 15 minutes after 5 consecutive failed logins", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: TEST_PASSWORD });

    for (let i = 0; i < 5; i++) {
      await request(app).post("/auth/login").send({ email, password: "WrongPassword123!" });
    }

    const lockedRes = await request(app)
      .post("/auth/login")
      .send({ email, password: TEST_PASSWORD });

    expect(lockedRes.status).toBe(423);
  });
});

describe("GET /auth/me", () => {
  it("rejects a request with no access token", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a malformed access token", async () => {
    const res = await request(app).get("/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("returns the current user for a valid access token", async () => {
    const email = uniqueEmail();
    const registerRes = await request(app)
      .post("/auth/register")
      .send({ email, password: TEST_PASSWORD });

    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${registerRes.body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });
});

describe("POST /auth/refresh", () => {
  it("rejects a missing refresh cookie", async () => {
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("rejects an unknown refresh token", async () => {
    const res = await request(app).post("/auth/refresh").set("Cookie", "refreshToken=doesnotexist");
    expect(res.status).toBe(401);
  });

  it("rotates the refresh token and issues a new access token", async () => {
    const email = uniqueEmail();
    const registerRes = await request(app)
      .post("/auth/register")
      .send({ email, password: TEST_PASSWORD });
    const refreshCookie = extractCookie(registerRes, "refreshToken");

    const res = await request(app).post("/auth/refresh").set("Cookie", refreshCookie);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(extractCookie(res, "refreshToken")).not.toBe(refreshCookie);
  });

  it("detects reuse of an already-rotated refresh token and revokes every session for that user", async () => {
    const email = uniqueEmail();
    const registerRes = await request(app)
      .post("/auth/register")
      .send({ email, password: TEST_PASSWORD });
    const originalCookie = extractCookie(registerRes, "refreshToken");

    const firstRefresh = await request(app).post("/auth/refresh").set("Cookie", originalCookie);
    expect(firstRefresh.status).toBe(200);
    const rotatedCookie = extractCookie(firstRefresh, "refreshToken");

    const reuseRes = await request(app).post("/auth/refresh").set("Cookie", originalCookie);
    expect(reuseRes.status).toBe(401);

    const afterTheftRes = await request(app).post("/auth/refresh").set("Cookie", rotatedCookie);
    expect(afterTheftRes.status).toBe(401);
  });
});

describe("POST /auth/logout", () => {
  it("is a no-op when no refresh cookie is present", async () => {
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
  });

  it("revokes the refresh token so it can no longer be used to refresh", async () => {
    const email = uniqueEmail();
    const registerRes = await request(app)
      .post("/auth/register")
      .send({ email, password: TEST_PASSWORD });
    const refreshCookie = extractCookie(registerRes, "refreshToken");

    const logoutRes = await request(app).post("/auth/logout").set("Cookie", refreshCookie);
    expect(logoutRes.status).toBe(204);

    const afterLogoutRes = await request(app).post("/auth/refresh").set("Cookie", refreshCookie);
    expect(afterLogoutRes.status).toBe(401);
  });
});
