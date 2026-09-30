import { randomUUID } from "node:crypto";
import { compareDummyPassword, comparePassword } from "@/lib/password";
import {
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyAdminRefreshToken,
} from "@/lib/admin-jwt";
import {
  getAdminByEmail,
  getAdminById,
  touchAdminLastLoginAt,
} from "@/services/admin-account.service";
import {
  deleteAdminRefreshSession,
  rotateAdminRefreshSession,
  saveAdminRefreshSession,
} from "@/services/admin-session.service";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";
import { ERROR_MESSAGES } from "@/constants/messages";

/*
 * `auth.service.ts`의 구조를 미러링한다. 공통화하지 않는 이유는 설계 문서에 있다 —
 * 만료, 세션 키, 비활성화 규칙 같은 정책이 앞으로 갈라진다.
 */

export interface AdminAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthAdmin {
  id: string;
  name: string;
  email: string;
}

export interface AdminLoginResult extends AdminAuthTokens {
  admin: AuthAdmin;
}

export interface AdminRefreshResult extends AdminAuthTokens {
  admin: AuthAdmin;
}

export async function adminLogin(email: string, password: string): Promise<AdminLoginResult> {
  const admin = await getAdminByEmail(email);

  if (!admin) {
    // 계정이 없을 때도 같은 시간이 걸리는 compare를 돌린다 — 응답 시간으로 어느
    // 이메일이 어드민인지 가려낼 수 없게 한다.
    await compareDummyPassword(password);
    throw new HttpError(401, "INVALID_CREDENTIALS", ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  const passwordMatches = await comparePassword(password, admin.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, "INVALID_CREDENTIALS", ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  const sid = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAdminAccessToken({ sub: admin.id, email: admin.email, sid, ver: admin.sessionVersion }),
    signAdminRefreshToken({ sub: admin.id, sid, ver: admin.sessionVersion }),
  ]);

  await saveAdminRefreshSession(admin.id, sid, refreshToken);

  // 마지막 로그인 시각은 부가 정보다. 기록 실패로 로그인을 막지 않는다.
  try {
    await touchAdminLastLoginAt(admin.id, new Date());
  } catch (err) {
    logger.warn({ err }, "Admin lastLoginAt update failed");
  }

  return {
    accessToken,
    refreshToken,
    admin: { id: admin.id, name: admin.name, email: admin.email },
  };
}

export async function adminRefresh(refreshToken: string): Promise<AdminRefreshResult> {
  let payload;
  try {
    payload = await verifyAdminRefreshToken(refreshToken);
  } catch (err) {
    logger.debug({ err }, "admin refresh token verification failed");
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  const admin = await getAdminById(payload.sub);
  if (!admin) {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  if (payload.ver !== admin.sessionVersion) {
    try {
      await deleteAdminRefreshSession(admin.id, payload.sid);
    } catch (err) {
      logger.warn({ err }, "Stale admin session cleanup failed after version mismatch");
    }
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  const [accessToken, newRefreshToken] = await Promise.all([
    signAdminAccessToken({
      sub: admin.id,
      email: admin.email,
      sid: payload.sid,
      ver: admin.sessionVersion,
    }),
    signAdminRefreshToken({ sub: admin.id, sid: payload.sid, ver: admin.sessionVersion }),
  ]);

  const rotated = await rotateAdminRefreshSession(
    admin.id,
    payload.sid,
    refreshToken,
    newRefreshToken,
  );
  if (!rotated) {
    // 이미 회전된 토큰이거나 없는 세션이다. 재사용(탈취) 신호로 보고 이 sid를 폐기한다.
    // 어드민 콘솔은 이 401을 자동 재시도하지 않고 재로그인으로 유도해야 한다.
    await deleteAdminRefreshSession(admin.id, payload.sid);
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  return {
    accessToken,
    refreshToken: newRefreshToken,
    admin: { id: admin.id, name: admin.name, email: admin.email },
  };
}

export async function adminLogout(adminId: string, sid: string): Promise<void> {
  await deleteAdminRefreshSession(adminId, sid);
}
