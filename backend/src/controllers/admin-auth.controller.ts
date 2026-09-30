import type { Request, Response } from "express";
import { getEnv } from "@/config/env";
import { loginSchema } from "@/schemas/auth.schema";
import { adminLogin, adminLogout, adminRefresh } from "@/services/admin-auth.service";
import { HttpError } from "@/utils/http-error";
import { ERROR_MESSAGES } from "@/constants/messages";
import { requireAdmin } from "@/utils/require-admin";
import {
  ADMIN_REFRESH_TOKEN_COOKIE,
  clearAdminRefreshTokenCookie,
  setAdminRefreshTokenCookie,
} from "@/utils/admin-auth-cookie";

export async function adminLoginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? ERROR_MESSAGES.VALIDATION_ERROR,
    );
  }

  const result = await adminLogin(parsed.data.email, parsed.data.password);

  setAdminRefreshTokenCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, admin: result.admin });
}

export async function adminRefreshHandler(req: Request, res: Response) {
  // 쿠키는 브라우저가 자동으로 첨부하므로 CSRF 방어선을 하나 더 둔다 — 제품
  // `refreshHandler`와 같은 검사이며, 비교 대상만 어드민 오리진이다.
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin !== getEnv().ADMIN_CORS_ORIGIN) {
    throw new HttpError(403, "INVALID_ORIGIN", ERROR_MESSAGES.INVALID_ORIGIN);
  }

  const refreshToken = req.cookies?.[ADMIN_REFRESH_TOKEN_COOKIE];
  if (typeof refreshToken !== "string") {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  try {
    const result = await adminRefresh(refreshToken);
    setAdminRefreshTokenCookie(res, result.refreshToken);
    res.status(200).json({ accessToken: result.accessToken, admin: result.admin });
  } catch (err) {
    clearAdminRefreshTokenCookie(res);
    throw err;
  }
}

export async function adminLogoutHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);

  await adminLogout(admin.sub, admin.sid);

  clearAdminRefreshTokenCookie(res);
  res.status(204).send();
}

export async function adminMeHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);

  res.status(200).json({ admin: { id: admin.sub, email: admin.email } });
}
