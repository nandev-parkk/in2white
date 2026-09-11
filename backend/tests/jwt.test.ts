import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { getEnv } from "@/config/env";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/jwt";

describe("access token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "sid-1",
      ver: 3,
    });
    const payload = await verifyAccessToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("user@example.com");
    expect(payload.sid).toBe("sid-1");
    expect(payload.ver).toBe(3);
    expect(payload.type).toBe("access");
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "sid-1",
      ver: 0,
    });
    const tampered = `${token}tampered`;

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("rejects a refresh token presented as an access token", async () => {
    const refreshToken = await signRefreshToken({ sub: "user-1", sid: "sid-1", ver: 0 });

    await expect(verifyAccessToken(refreshToken)).rejects.toThrow();
  });

  it("produces a different token each time even with identical claims (jti uniqueness)", async () => {
    const tokenA = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "sid-1",
      ver: 0,
    });
    const tokenB = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "sid-1",
      ver: 0,
    });

    expect(tokenA).not.toBe(tokenB);
  });
});

describe("refresh token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signRefreshToken({ sub: "user-1", sid: "sid-1", ver: 3 });
    const payload = await verifyRefreshToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.sid).toBe("sid-1");
    expect(payload.ver).toBe(3);
    expect(payload.type).toBe("refresh");
  });

  it("rejects a tampered token", async () => {
    const token = await signRefreshToken({ sub: "user-1", sid: "sid-1", ver: 0 });
    const tampered = `${token}tampered`;

    await expect(verifyRefreshToken(tampered)).rejects.toThrow();
  });

  it("rejects an access token presented as a refresh token", async () => {
    const accessToken = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "sid-1",
      ver: 0,
    });

    await expect(verifyRefreshToken(accessToken)).rejects.toThrow();
  });

  it("produces a different token each time even with identical claims (jti uniqueness)", async () => {
    const tokenA = await signRefreshToken({ sub: "user-1", sid: "sid-1", ver: 0 });
    const tokenB = await signRefreshToken({ sub: "user-1", sid: "sid-1", ver: 0 });

    expect(tokenA).not.toBe(tokenB);
  });

  it("treats a legacy refresh token without ver as version zero", async () => {
    const token = await new SignJWT({ sid: "sid-1", type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("14d")
      .sign(new TextEncoder().encode(getEnv().JWT_REFRESH_SECRET));

    await expect(verifyRefreshToken(token)).resolves.toMatchObject({
      sub: "user-1",
      sid: "sid-1",
      ver: 0,
      type: "refresh",
    });
  });

  it.each([-1, 1.5, "1"])("rejects an invalid refresh token version: %s", async (ver) => {
    const token = await new SignJWT({ sid: "sid-1", type: "refresh", ver })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("14d")
      .sign(new TextEncoder().encode(getEnv().JWT_REFRESH_SECRET));

    await expect(verifyRefreshToken(token)).rejects.toThrow("Invalid token session version");
  });
});
