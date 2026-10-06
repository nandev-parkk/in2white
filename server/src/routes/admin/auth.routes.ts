import { Router } from "express";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { adminLoginRateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { asyncHandler } from "@/utils/async-handler";
import {
  adminLoginHandler,
  adminLogoutHandler,
  adminMeHandler,
  adminRefreshHandler,
} from "@/controllers/admin-auth.controller";

export const adminAuthRouter = Router();

// 로그인만 좁은 버킷을 붙인다. refresh는 쿠키를, 나머지는 access 토큰을 요구하므로
// 무차별 대입의 대상이 아니다.
adminAuthRouter.post("/login", adminLoginRateLimitMiddleware, asyncHandler(adminLoginHandler));
adminAuthRouter.post("/refresh", asyncHandler(adminRefreshHandler));
adminAuthRouter.post("/logout", authenticateAdmin, asyncHandler(adminLogoutHandler));
adminAuthRouter.get("/me", authenticateAdmin, asyncHandler(adminMeHandler));
