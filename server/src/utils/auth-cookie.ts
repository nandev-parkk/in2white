import type { Response } from "express";
import { getEnv } from "@/config/env";

export const REFRESH_TOKEN_COOKIE = "refreshToken";
const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function refreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/auth/refresh",
  };
}

export function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...refreshTokenCookieOptions(),
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  });
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions());
}
