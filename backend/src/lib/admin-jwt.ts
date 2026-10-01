import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/config/env";

/*
 * 어드민 토큰은 제품 토큰과 두 겹으로 분리한다. 서명 시크릿이 다르고(`JWT_ADMIN_*`),
 * payload의 `type`도 `admin-` 접두사를 쓴다. 한쪽이 무너져도 다른 쪽이 남는다.
 */

export interface AdminAccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  ver: number;
  type: "admin-access";
  exp: number;
}

export interface AdminRefreshTokenPayload {
  sub: string;
  sid: string;
  ver: number;
  type: "admin-refresh";
  exp: number;
}

/** 어드민 access는 제품과 같은 15분, refresh는 14일이 아닌 1일이다. 세션 탈취의 피해 범위가 서비스 전체다. */
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "1d";

function getAdminAccessSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_ADMIN_SECRET);
}

function getAdminRefreshSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_ADMIN_REFRESH_SECRET);
}

/** 어드민 토큰에는 `ver` 없는 과거 발급분이 없으므로 기본값으로 눙치지 않고 형식을 강제한다. */
function requireSessionVersion(ver: unknown): number {
  if (typeof ver !== "number" || !Number.isInteger(ver) || ver < 0) {
    throw new Error("Invalid token session version");
  }
  return ver;
}

export async function signAdminAccessToken(payload: {
  sub: string;
  email: string;
  sid: string;
  ver: number;
}): Promise<string> {
  return new SignJWT({
    email: payload.email,
    sid: payload.sid,
    ver: payload.ver,
    type: "admin-access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getAdminAccessSecretKey());
}

export async function verifyAdminAccessToken(token: string): Promise<AdminAccessTokenPayload> {
  const { payload } = await jwtVerify(token, getAdminAccessSecretKey());

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.sid !== "string" ||
    payload.type !== "admin-access" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Invalid admin access token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    sid: payload.sid,
    ver: requireSessionVersion(payload.ver),
    type: "admin-access",
    exp: payload.exp,
  };
}

export async function signAdminRefreshToken(payload: {
  sub: string;
  sid: string;
  ver: number;
}): Promise<string> {
  return new SignJWT({ sid: payload.sid, ver: payload.ver, type: "admin-refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(getAdminRefreshSecretKey());
}

export async function verifyAdminRefreshToken(token: string): Promise<AdminRefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getAdminRefreshSecretKey());

  if (
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string" ||
    payload.type !== "admin-refresh" ||
    typeof payload.exp !== "number"
  ) {
    throw new Error("Invalid admin refresh token payload");
  }

  return {
    sub: payload.sub,
    sid: payload.sid,
    ver: requireSessionVersion(payload.ver),
    type: "admin-refresh",
    exp: payload.exp,
  };
}
