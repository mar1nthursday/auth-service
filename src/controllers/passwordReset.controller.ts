import type { Request, Response } from "express";
import { z } from "zod";
import * as passwordResetService from "../services/passwordReset.service";

const requestSchema = z.object({
  email: z.string().email(),
});

const confirmSchema = z.object({
  token: z.string(),
  password: z.string().min(12).max(256),
});

export async function requestHandler(req: Request, res: Response) {
  const { email } = requestSchema.parse(req.body);
  await passwordResetService.requestReset(email, req.ip);
  res.status(202).json({ message: "If that email is registered, a reset link has been sent." });
}

export async function confirmHandler(req: Request, res: Response) {
  const { token, password } = confirmSchema.parse(req.body);
  await passwordResetService.confirmReset(token, password, req.ip);
  res.status(200).json({ message: "Password has been reset. Please log in again." });
}
