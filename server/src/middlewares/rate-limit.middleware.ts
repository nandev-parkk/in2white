import rateLimit from "express-rate-limit";
import { ERROR_MESSAGES } from "@/constants/messages";

export const PRODUCT_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  limit: 100,
} as const;

/*
 * 어드민 계정은 수가 적고 하나만 뚫려도 서비스 전체 권한이 넘어간다. 그래서 로그인만
 * 따로, 제품 버킷보다 훨씬 좁게 잡는다.
 */
export const ADMIN_LOGIN_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  limit: 10,
} as const;

export const rateLimitMiddleware = rateLimit({
  ...PRODUCT_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
});

export const adminLoginRateLimitMiddleware = rateLimit({
  ...ADMIN_LOGIN_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: ERROR_MESSAGES.ADMIN_LOGIN_RATE_LIMITED,
    },
  },
});
