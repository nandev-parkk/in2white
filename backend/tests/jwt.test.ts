import { describe, expect, it } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/jwt";

describe("access token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });
    const payload = await verifyAccessToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("user@example.com");
    expect(payload.sid).toBe("sid-1");
    expect(payload.type).toBe("access");
    expect(payload.exp).toEqual(expect.any(Number));
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });
    const tampered = `${token}tampered`;

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("rejects a refresh token presented as an access token", async () => {
    const refreshToken = await signRefreshToken({ sub: "user-1", sid: "sid-1" });

    await expect(verifyAccessToken(refreshToken)).rejects.toThrow();
  });

  it("produces a different token each time even with identical claims (jti uniqueness)", async () => {
    const tokenA = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "sid-1",
    });
    const tokenB = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "sid-1",
    });

    expect(tokenA).not.toBe(tokenB);
  });
});

describe("refresh token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signRefreshToken({ sub: "user-1", sid: "sid-1" });
    const payload = await verifyRefreshToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.sid).toBe("sid-1");
    expect(payload.type).toBe("refresh");
  });

  it("rejects a tampered token", async () => {
    const token = await signRefreshToken({ sub: "user-1", sid: "sid-1" });
    const tampered = `${token}tampered`;

    await expect(verifyRefreshToken(tampered)).rejects.toThrow();
  });

  it("rejects an access token presented as a refresh token", async () => {
    const accessToken = await signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "sid-1",
    });

    await expect(verifyRefreshToken(accessToken)).rejects.toThrow();
  });

  it("produces a different token each time even with identical claims (jti uniqueness)", async () => {
    const tokenA = await signRefreshToken({ sub: "user-1", sid: "sid-1" });
    const tokenB = await signRefreshToken({ sub: "user-1", sid: "sid-1" });

    expect(tokenA).not.toBe(tokenB);
  });
});
