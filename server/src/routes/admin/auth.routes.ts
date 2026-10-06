import { Router } from "express";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import {
  adminApiRateLimitMiddleware,
  adminLoginAccountRateLimitMiddleware,
  adminLoginRateLimitMiddleware,
  adminRefreshRateLimitMiddleware,
} from "@/middlewares/rate-limit.middleware";
import { asyncHandler } from "@/utils/async-handler";
import {
  adminLoginHandler,
  adminLogoutHandler,
  adminMeHandler,
  adminRefreshHandler,
} from "@/controllers/admin-auth.controller";

export const adminAuthRouter = Router();

// 로그인 실패와 refresh는 별도 제한을 사용하고, 인증된 me/logout은 관리자 세션 기준으로 제한한다.
adminAuthRouter.post(
  "/login",
  adminLoginRateLimitMiddleware,
  adminLoginAccountRateLimitMiddleware,
  asyncHandler(adminLoginHandler),
);
adminAuthRouter.post(
  "/refresh",
  adminRefreshRateLimitMiddleware,
  asyncHandler(adminRefreshHandler),
);
adminAuthRouter.post(
  "/logout",
  authenticateAdmin,
  adminApiRateLimitMiddleware,
  asyncHandler(adminLogoutHandler),
);
adminAuthRouter.get(
  "/me",
  authenticateAdmin,
  adminApiRateLimitMiddleware,
  asyncHandler(adminMeHandler),
);
