import { Router } from "express";
import {
  loginHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
  registerHandler,
} from "../controllers/auth.controller";
import {
  disableHandler,
  enableHandler,
  setupHandler,
  verifyHandler,
} from "../controllers/twoFactor.controller";
import {
  confirmHandler,
  requestHandler,
} from "../controllers/passwordReset.controller";
import { authRateLimiter } from "../middleware/rateLimiter";
import { requireAuth } from "../middleware/requireAuth";
import { asyncHandler } from "../utils/asyncHandler";

export const authRouter = Router();

authRouter.post("/register", authRateLimiter, asyncHandler(registerHandler));
authRouter.post("/login", authRateLimiter, asyncHandler(loginHandler));
authRouter.post("/refresh", asyncHandler(refreshHandler));
authRouter.post("/logout", asyncHandler(logoutHandler));
authRouter.get("/me", requireAuth, asyncHandler(meHandler));

authRouter.post("/2fa/verify", authRateLimiter, asyncHandler(verifyHandler));
authRouter.post("/2fa/setup", requireAuth, asyncHandler(setupHandler));
authRouter.post("/2fa/enable", requireAuth, authRateLimiter, asyncHandler(enableHandler));
authRouter.post("/2fa/disable", requireAuth, authRateLimiter, asyncHandler(disableHandler));

authRouter.post("/password-reset/request", authRateLimiter, asyncHandler(requestHandler));
authRouter.post("/password-reset/confirm", authRateLimiter, asyncHandler(confirmHandler));
