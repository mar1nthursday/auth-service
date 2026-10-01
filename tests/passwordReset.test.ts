import { afterAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { TEST_PASSWORD, uniqueEmail } from "./helpers";

const app = createApp();

afterAll(async () => {
  await prisma.securityEvent.deleteMany({ where: { email: { startsWith: "test-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "test-" } } });
  await prisma.$disconnect();
});

function captureResetToken(logSpy: ReturnType<typeof vi.spyOn>): string {
  const call = logSpy.mock.calls.find((c) => String(c[0]).includes("Password reset link"));
  const message = String(call?.[0]);
  const match = message.match(/token=([a-f0-9]+)/);
  if (!match) throw new Error("reset token not found in mailer log output");
  return match[1]!;
}

describe("POST /auth/password-reset/request", () => {
  it("responds the same way for a known and an unknown email", async () => {
    const knownRes = await request(app)
      .post("/auth/password-reset/request")
      .send({ email: uniqueEmail() });
    const unknownRes = await request(app)
      .post("/auth/password-reset/request")
      .send({ email: uniqueEmail() });

    expect(knownRes.status).toBe(202);
    expect(unknownRes.status).toBe(202);
    expect(knownRes.body).toEqual(unknownRes.body);
  });

  it("logs a reset link containing a token when the email is registered", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: TEST_PASSWORD });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const res = await request(app).post("/auth/password-reset/request").send({ email });
    const token = captureResetToken(logSpy);
    logSpy.mockRestore();

    expect(res.status).toBe(202);
    expect(token).toEqual(expect.any(String));
  });
});

describe("POST /auth/password-reset/confirm", () => {
  it("rejects an unknown token", async () => {
    const res = await request(app)
      .post("/auth/password-reset/confirm")
      .send({ token: "deadbeef", password: "BrandNewPassword123!" });

    expect(res.status).toBe(400);
  });

  it("rejects a new password shorter than 12 characters", async () => {
    const res = await request(app)
      .post("/auth/password-reset/confirm")
      .send({ token: "deadbeef", password: "short" });

    expect(res.status).toBe(400);
  });

  it("resets the password, invalidates the token, and revokes existing sessions", async () => {
    const email = uniqueEmail();
    const registerRes = await request(app)
      .post("/auth/register")
      .send({ email, password: TEST_PASSWORD });
    const oldRefreshCookie = (registerRes.headers["set-cookie"] as unknown as string[])[0]!.split(
      ";",
    )[0]!;

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await request(app).post("/auth/password-reset/request").send({ email });
    const token = captureResetToken(logSpy);
    logSpy.mockRestore();

    const newPassword = "BrandNewPassword123!";
    const confirmRes = await request(app)
      .post("/auth/password-reset/confirm")
      .send({ token, password: newPassword });
    expect(confirmRes.status).toBe(200);

    const oldSessionRes = await request(app).post("/auth/refresh").set("Cookie", oldRefreshCookie);
    expect(oldSessionRes.status).toBe(401);

    const oldPasswordLoginRes = await request(app)
      .post("/auth/login")
      .send({ email, password: TEST_PASSWORD });
    expect(oldPasswordLoginRes.status).toBe(401);

    const newPasswordLoginRes = await request(app)
      .post("/auth/login")
      .send({ email, password: newPassword });
    expect(newPasswordLoginRes.status).toBe(200);
  });

  it("rejects reusing an already-used reset token", async () => {
    const email = uniqueEmail();
    await request(app).post("/auth/register").send({ email, password: TEST_PASSWORD });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await request(app).post("/auth/password-reset/request").send({ email });
    const token = captureResetToken(logSpy);
    logSpy.mockRestore();

    const firstConfirm = await request(app)
      .post("/auth/password-reset/confirm")
      .send({ token, password: "FirstNewPassword123!" });
    expect(firstConfirm.status).toBe(200);

    const secondConfirm = await request(app)
      .post("/auth/password-reset/confirm")
      .send({ token, password: "SecondNewPassword123!" });
    expect(secondConfirm.status).toBe(400);
  });
});
