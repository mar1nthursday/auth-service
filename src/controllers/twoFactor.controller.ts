import type { Request, Response } from "express";
import { z } from "zod";
import * as authService from "../services/auth.service";
import * as twoFactorService from "../services/twoFactor.service";
import { HttpError } from "../middleware/errorHandler";
import type { AuthedRequest } from "../middleware/requireAuth";
import { prisma } from "../config/prisma";
import { setRefreshCookie } from "../utils/cookies";

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be a 6-digit number"),
});

const verifySchema = z.object({
  twoFactorToken: z.string(),
  code: z.string().regex(/^\d{6}$/, "Code must be a 6-digit number"),
});

export async function setupHandler(req: AuthedRequest, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new HttpError(404, "User not found");

  const { secret, otpauthUrl } = await twoFactorService.setup(user.id, user.email);
  res.json({ secret, otpauthUrl });
}

export async function enableHandler(req: AuthedRequest, res: Response) {
  const { code } = codeSchema.parse(req.body);
  await twoFactorService.enable(req.userId!, code, req.ip);
  res.status(204).send();
}

export async function disableHandler(req: AuthedRequest, res: Response) {
  const { code } = codeSchema.parse(req.body);
  await twoFactorService.disable(req.userId!, code, req.ip);
  res.status(204).send();
}

export async function verifyHandler(req: Request, res: Response) {
  const { twoFactorToken, code } = verifySchema.parse(req.body);
  const { accessToken, refreshToken } = await authService.completeTwoFactorLogin(
    twoFactorToken,
    code,
    req.ip,
  );
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken });
}
