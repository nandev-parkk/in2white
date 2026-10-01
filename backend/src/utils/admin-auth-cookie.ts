import type { Response } from "express";
import { getEnv } from "@/config/env";

/*
 * 제품 쿠키와 이름·경로를 모두 나눈다. 이름이 같으면 어드민 콘솔과 제품을 같은
 * 호스트에 배포했을 때 서로의 쿠키를 덮어쓴다. 경로는 refresh 엔드포인트로 좁혀서
 * 다른 요청에는 아예 첨부되지 않게 한다.
 */
export const ADMIN_REFRESH_TOKEN_COOKIE = "adminRefreshToken";

/** `lib/admin-jwt.ts`의 refresh 만료와 같은 1일이다. */
const ADMIN_REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function adminRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/admin/auth/refresh",
  };
}

export function setAdminRefreshTokenCookie(res: Response, token: string) {
  res.cookie(ADMIN_REFRESH_TOKEN_COOKIE, token, {
    ...adminRefreshTokenCookieOptions(),
    maxAge: ADMIN_REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  });
}

export function clearAdminRefreshTokenCookie(res: Response) {
  res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE, adminRefreshTokenCookieOptions());
}
