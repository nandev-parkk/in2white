import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  ver: number;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  ver: number;
  type: "refresh";
}

function getAccessSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

function getRefreshSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_REFRESH_SECRET);
}

export async function signAccessToken(payload: {
  sub: string;
  email: string;
  sid: string;
  ver: number;
}): Promise<string> {
  return new SignJWT({ email: payload.email, sid: payload.sid, ver: payload.ver, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getAccessSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecretKey());

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.sid !== "string" ||
    payload.type !== "access"
  ) {
    throw new Error("Invalid access token payload");
  }

  const ver = payload.ver ?? 0;
  if (typeof ver !== "number" || !Number.isInteger(ver) || ver < 0) {
    throw new Error("Invalid token session version");
  }

  return { sub: payload.sub, email: payload.email, sid: payload.sid, ver, type: "access" };
}

export async function signRefreshToken(payload: {
  sub: string;
  sid: string;
  ver: number;
}): Promise<string> {
  return new SignJWT({ sid: payload.sid, ver: payload.ver, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getRefreshSecretKey());
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getRefreshSecretKey());

  if (
    typeof payload.sub !== "string" ||
    typeof payload.sid !== "string" ||
    payload.type !== "refresh"
  ) {
    throw new Error("Invalid refresh token payload");
  }

  const ver = payload.ver ?? 0;
  if (typeof ver !== "number" || !Number.isInteger(ver) || ver < 0) {
    throw new Error("Invalid token session version");
  }

  return { sub: payload.sub, sid: payload.sid, ver, type: "refresh" };
}
