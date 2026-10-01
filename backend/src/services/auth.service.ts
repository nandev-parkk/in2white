import { randomUUID } from "node:crypto";
import { compareDummyPassword, comparePassword } from "@/lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { getUserByEmail, getUserById } from "@/services/user.service";
import {
  deleteRefreshSession,
  rotateRefreshSession,
  saveRefreshSession,
} from "@/services/session.service";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";
import { ERROR_MESSAGES } from "@/constants/messages";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export interface LoginResult extends AuthTokens {
  user: AuthUser;
}

export interface RefreshResult extends AuthTokens {
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await getUserByEmail(email);

  if (!user) {
    await compareDummyPassword(password);
    throw new HttpError(401, "INVALID_CREDENTIALS", ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, "INVALID_CREDENTIALS", ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  /*
   * 정지 여부는 비밀번호 검증을 통과한 뒤에 본다. 먼저 보면 이메일만 아는 사람이
   * 비밀번호 없이 계정의 존재와 상태를 알아낼 수 있다.
   */
  if (user.deactivatedAt) {
    throw new HttpError(403, "ACCOUNT_DEACTIVATED", ERROR_MESSAGES.ACCOUNT_DEACTIVATED);
  }

  const sid = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email, sid, ver: user.sessionVersion }),
    signRefreshToken({ sub: user.id, sid, ver: user.sessionVersion }),
  ]);

  await saveRefreshSession(user.id, sid, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function refresh(refreshToken: string): Promise<RefreshResult> {
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch (err) {
    logger.debug({ err }, "refresh token verification failed");
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  if (payload.ver !== user.sessionVersion) {
    try {
      await deleteRefreshSession(user.id, payload.sid);
    } catch (err) {
      logger.warn({ err }, "Stale refresh session cleanup failed after version mismatch");
    }
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  /*
   * 정지는 로그인만 막는 게 아니다. 이미 발급된 refresh 토큰이 남아 있으면 최대 14일간
   * 세션이 살아 있으므로, 갱신 시점에 막고 해당 세션도 함께 폐기한다.
   */
  if (user.deactivatedAt) {
    try {
      await deleteRefreshSession(user.id, payload.sid);
    } catch (err) {
      logger.warn({ err }, "Session cleanup failed after deactivated account refresh");
    }

    throw new HttpError(403, "ACCOUNT_DEACTIVATED", ERROR_MESSAGES.ACCOUNT_DEACTIVATED);
  }

  const [accessToken, newRefreshToken] = await Promise.all([
    signAccessToken({
      sub: user.id,
      email: user.email,
      sid: payload.sid,
      ver: user.sessionVersion,
    }),
    signRefreshToken({ sub: user.id, sid: payload.sid, ver: user.sessionVersion }),
  ]);

  const rotated = await rotateRefreshSession(user.id, payload.sid, refreshToken, newRefreshToken);
  if (!rotated) {
    // 제시된 토큰이 이미 회전되어 폐기됐거나 세션이 존재하지 않음 — 재사용(탈취) 신호로 보고
    // 이 sid의 세션을 완전히 폐기한다(reuse detection). 프론트엔드는 이 401을 자동 재시도하면
    // 안 되고 재로그인으로 유도해야 한다 — 그렇지 않으면 정상적인 재시도조차 세션을 죽인다.
    await deleteRefreshSession(user.id, payload.sid);
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", ERROR_MESSAGES.INVALID_REFRESH_TOKEN);
  }

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function logout(userId: string, sid: string): Promise<void> {
  await deleteRefreshSession(userId, sid);
}
