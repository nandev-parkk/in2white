import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware";
import {
  productLoginRateLimitMiddlewares,
  productRefreshRateLimitMiddleware,
  productApiRateLimitMiddleware,
} from "@/middlewares/rate-limit.middleware";
import { asyncHandler } from "@/utils/async-handler";
import { loginHandler, logoutHandler, refreshHandler } from "@/controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/login", ...productLoginRateLimitMiddlewares, asyncHandler(loginHandler));
authRouter.post("/refresh", productRefreshRateLimitMiddleware, asyncHandler(refreshHandler));
authRouter.post(
  "/logout",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(logoutHandler),
);
