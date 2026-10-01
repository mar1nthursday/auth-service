import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service";
import { HttpError } from "../middleware/errorHandler";
import type { AuthedRequest } from "../middleware/requireAuth";
import { prisma } from "../config/prisma";
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from "../utils/cookies";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
});

export async function registerHandler(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);
  const { accessToken, refreshToken } = await authService.register(email, password, req.ip);
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ accessToken });
}

export async function loginHandler(req: Request, res: Response) {
  const { email, password } = credentialsSchema.parse(req.body);
  const result = await authService.login(email, password, req.ip);

  if (result.twoFactorRequired) {
    res.json({ twoFactorRequired: true, twoFactorToken: result.twoFactorToken });
    return;
  }

  setRefreshCookie(res, result.refreshToken);
  res.json({ accessToken: result.accessToken });
}

export async function refreshHandler(req: Request, res: Response) {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (!presented) throw new HttpError(401, "Missing refresh token");

  const { accessToken, refreshToken } = await authService.refresh(presented, req.ip);
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken });
}

export async function logoutHandler(req: Request, res: Response) {
  const presented = req.cookies?.[REFRESH_COOKIE];
  if (presented) await authService.logout(presented, req.ip);
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function meHandler(req: AuthedRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, totpEnabled: true, createdAt: true },
  });
  if (!user) throw new HttpError(404, "User not found");
  res.json(user);
}
