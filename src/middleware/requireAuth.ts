import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/tokens";
import { HttpError } from "./errorHandler";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing or invalid Authorization header");
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));
    req.userId = payload.sub;
    next();
  } catch {
    throw new HttpError(401, "Invalid or expired access token");
  }
}
