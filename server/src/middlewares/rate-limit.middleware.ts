import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { ERROR_MESSAGES } from "@/constants/messages";
import { verifyAdminRefreshToken } from "@/lib/admin-jwt";
import { verifyRefreshToken } from "@/lib/jwt";
import { ADMIN_REFRESH_TOKEN_COOKIE } from "@/utils/admin-auth-cookie";
import { REFRESH_TOKEN_COOKIE } from "@/utils/auth-cookie";

const MINUTE = 60 * 1_000;
const FIFTEEN_MINUTES = 15 * MINUTE;
const commonOptions = { standardHeaders: true, legacyHeaders: false } as const;

export const PRODUCT_LOGIN_IP_RATE_LIMIT = {
  windowMs: FIFTEEN_MINUTES,
  limit: 60,
} as const;

export const LOGIN_ACCOUNT_RATE_LIMIT = {
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
} as const;

export const REFRESH_SESSION_RATE_LIMIT = {
  windowMs: FIFTEEN_MINUTES,
  limit: 30,
} as const;

export const INVALID_REFRESH_IP_RATE_LIMIT = {
  windowMs: FIFTEEN_MINUTES,
  limit: 60,
} as const;

export const PRODUCT_READ_RATE_LIMIT = {
  windowMs: MINUTE,
  limit: 120,
} as const;

export const PRODUCT_WRITE_RATE_LIMIT = {
  windowMs: MINUTE,
  limit: 60,
} as const;

export const PASSWORD_CHANGE_RATE_LIMIT = {
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
} as const;

export const ADMIN_LOGIN_RATE_LIMIT = {
  windowMs: FIFTEEN_MINUTES,
  limit: 10,
} as const;

export const ADMIN_READ_RATE_LIMIT = {
  windowMs: MINUTE,
  limit: 120,
} as const;

export const ADMIN_WRITE_RATE_LIMIT = {
  windowMs: MINUTE,
  limit: 30,
} as const;

function requestIpKey(req: Request): string {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || "unknown");
}

function accountIpKey(req: Request): string {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${requestIpKey(req)}:${email}`;
}

function sessionKey(req: Request): string {
  if (req.user) return `${req.user.sub}:${req.user.sid}`;
  if (req.admin) return `${req.admin.sub}:${req.admin.sid}`;
  return requestIpKey(req);
}

const productLoginIpLimiter = rateLimit({
  ...commonOptions,
  ...PRODUCT_LOGIN_IP_RATE_LIMIT,
  skipSuccessfulRequests: true,
});

const productLoginAccountLimiter = rateLimit({
  ...commonOptions,
  ...LOGIN_ACCOUNT_RATE_LIMIT,
  keyGenerator: accountIpKey,
  skipSuccessfulRequests: true,
});

export const productLoginRateLimitMiddlewares: RequestHandler[] = [
  productLoginIpLimiter,
  productLoginAccountLimiter,
];

export const adminLoginRateLimitMiddleware = rateLimit({
  ...commonOptions,
  ...ADMIN_LOGIN_RATE_LIMIT,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: ERROR_MESSAGES.ADMIN_LOGIN_RATE_LIMITED,
    },
  },
});

export const adminLoginAccountRateLimitMiddleware = rateLimit({
  ...commonOptions,
  ...LOGIN_ACCOUNT_RATE_LIMIT,
  keyGenerator: accountIpKey,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: ERROR_MESSAGES.ADMIN_LOGIN_RATE_LIMITED,
    },
  },
});

function createSessionLimiter(options: { windowMs: number; limit: number }) {
  return rateLimit({
    ...commonOptions,
    ...options,
    keyGenerator: (req) => sessionKey(req),
  });
}

const productReadLimiter = createSessionLimiter(PRODUCT_READ_RATE_LIMIT);
const productWriteLimiter = createSessionLimiter(PRODUCT_WRITE_RATE_LIMIT);
const passwordChangeLimiter = rateLimit({
  ...commonOptions,
  ...PASSWORD_CHANGE_RATE_LIMIT,
  keyGenerator: (req) => sessionKey(req),
  skipSuccessfulRequests: true,
});
const adminReadLimiter = createSessionLimiter(ADMIN_READ_RATE_LIMIT);
const adminWriteLimiter = createSessionLimiter(ADMIN_WRITE_RATE_LIMIT);

export const productApiRateLimitMiddleware: RequestHandler = (req, res, next) => {
  const limiter =
    req.method === "GET" || req.method === "HEAD" ? productReadLimiter : productWriteLimiter;
  limiter(req, res, next);
};

export const productPasswordChangeRateLimitMiddleware: RequestHandler = (req, res, next) => {
  passwordChangeLimiter(req, res, next);
};

export const adminApiRateLimitMiddleware: RequestHandler = (req, res, next) => {
  const limiter =
    req.method === "GET" || req.method === "HEAD" ? adminReadLimiter : adminWriteLimiter;
  limiter(req, res, next);
};

function createRefreshLimiter(
  cookieName: string,
  verify: (token: string) => Promise<{ sub: string; sid: string }>,
) {
  const sessionKeys = new WeakMap<Request, string>();
  const sessionLimiter = rateLimit({
    ...commonOptions,
    ...REFRESH_SESSION_RATE_LIMIT,
    keyGenerator: (req) => sessionKeys.get(req) ?? requestIpKey(req),
  });
  const invalidTokenLimiter = rateLimit({
    ...commonOptions,
    ...INVALID_REFRESH_IP_RATE_LIMIT,
  });

  return (
    req: Request,
    res: Parameters<RequestHandler>[1],
    next: Parameters<RequestHandler>[2],
  ) => {
    const token = req.cookies?.[cookieName];
    if (typeof token !== "string") {
      invalidTokenLimiter(req, res, next);
      return;
    }

    void verify(token)
      .then((payload) => {
        sessionKeys.set(req, `${payload.sub}:${payload.sid}`);
        sessionLimiter(req, res, next);
      })
      .catch(() => invalidTokenLimiter(req, res, next));
  };
}

export const productRefreshRateLimitMiddleware = createRefreshLimiter(
  REFRESH_TOKEN_COOKIE,
  verifyRefreshToken,
);

export const adminRefreshRateLimitMiddleware = createRefreshLimiter(
  ADMIN_REFRESH_TOKEN_COOKIE,
  verifyAdminRefreshToken,
);
