import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

function getSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey());

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid access token payload");
  }

  return { sub: payload.sub, email: payload.email };
}
