import type { Request, Response } from "express";
import { getEnv } from "@/config/env";
import { loginSchema } from "@/schemas/auth.schema";
import { login, logout, refresh } from "@/services/auth.service";
import { HttpError } from "@/utils/http-error";

const REFRESH_TOKEN_COOKIE = "refreshToken";
const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function refreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/auth/refresh",
  };
}

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...refreshTokenCookieOptions(),
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions());
}

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request body",
    );
  }

  const result = await login(parsed.data.email, parsed.data.password);

  setRefreshTokenCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
}

export async function refreshHandler(req: Request, res: Response) {
  // 쿠키는 브라우저가 자동으로 첨부하므로 CSRF 방어선을 하나 더 둔다: Origin 헤더가
  // 있는데 우리 CORS_ORIGIN과 다르면 거부한다. sameSite가 향후 cross-site 배포 때문에
  // "none"으로 바뀌더라도 이 검사가 남아있어 방어된다. Origin이 아예 없는 요청(서버 간
  // 호출 등)은 통과시킨다 — 그 경우는 애초에 쿠키가 전달되지 않으므로 위험이 없다.
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin !== getEnv().CORS_ORIGIN) {
    throw new HttpError(403, "INVALID_ORIGIN", "Invalid request origin");
  }

  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof refreshToken !== "string") {
    throw new HttpError(
      401,
      "INVALID_REFRESH_TOKEN",
      "로그인이 만료되었습니다. 다시 로그인해주세요",
    );
  }

  const result = await refresh(refreshToken);

  setRefreshTokenCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken });
}

export async function logoutHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing bearer token");
  }

  await logout(req.user.sub, req.user.sid);

  clearRefreshTokenCookie(res);
  res.status(204).send();
}
