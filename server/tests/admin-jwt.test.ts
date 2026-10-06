import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { getEnv } from "@/config/env";
import {
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyAdminAccessToken,
  verifyAdminRefreshToken,
} from "@/lib/admin-jwt";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/jwt";

describe("admin access token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signAdminAccessToken({
      sub: "admin-1",
      email: "admin@example.com",
      sid: "sid-1",
      ver: 3,
    });
    const payload = await verifyAdminAccessToken(token);

    expect(payload.sub).toBe("admin-1");
    expect(payload.email).toBe("admin@example.com");
    expect(payload.sid).toBe("sid-1");
    expect(payload.ver).toBe(3);
    expect(payload.type).toBe("admin-access");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("expires in 15 minutes", async () => {
    const token = await signAdminAccessToken({
      sub: "admin-1",
      email: "admin@example.com",
      sid: "sid-1",
      ver: 0,
    });
    const payload = await verifyAdminAccessToken(token);

    expect(payload.exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(15 * 60);
    expect(payload.exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(14 * 60);
  });

  it("rejects a tampered token", async () => {
    const token = await signAdminAccessToken({
      sub: "admin-1",
      email: "admin@example.com",
      sid: "sid-1",
      ver: 0,
    });

    await expect(verifyAdminAccessToken(`${token}tampered`)).rejects.toThrow();
  });

  it("rejects an admin refresh token presented as an admin access token", async () => {
    const refreshToken = await signAdminRefreshToken({ sub: "admin-1", sid: "sid-1", ver: 0 });

    await expect(verifyAdminAccessToken(refreshToken)).rejects.toThrow();
  });

  it("produces a different token each time even with identical claims (jti uniqueness)", async () => {
    const claims = { sub: "admin-1", email: "admin@example.com", sid: "sid-1", ver: 0 };

    expect(await signAdminAccessToken(claims)).not.toBe(await signAdminAccessToken(claims));
  });

  it.each([-1, 1.5, "1"])("rejects an invalid session version: %s", async (ver) => {
    const token = await new SignJWT({
      email: "admin@example.com",
      sid: "sid-1",
      type: "admin-access",
      ver,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("admin-1")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(new TextEncoder().encode(getEnv().JWT_ADMIN_SECRET));

    await expect(verifyAdminAccessToken(token)).rejects.toThrow("Invalid token session version");
  });
});

describe("admin refresh token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signAdminRefreshToken({ sub: "admin-1", sid: "sid-1", ver: 3 });
    const payload = await verifyAdminRefreshToken(token);

    expect(payload.sub).toBe("admin-1");
    expect(payload.sid).toBe("sid-1");
    expect(payload.ver).toBe(3);
    expect(payload.type).toBe("admin-refresh");
  });

  /*
   * 제품 refresh는 14일이지만 어드민은 1일이다. 어드민 세션 탈취의 피해 범위가
   * 서비스 전체이므로 재로그인 부담을 감수한다.
   */
  it("expires in one day", async () => {
    const token = await signAdminRefreshToken({ sub: "admin-1", sid: "sid-1", ver: 0 });
    const { exp } = await verifyAdminRefreshToken(token);

    expect(exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(24 * 60 * 60);
    expect(exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(23 * 60 * 60);
  });

  it("rejects an admin access token presented as an admin refresh token", async () => {
    const accessToken = await signAdminAccessToken({
      sub: "admin-1",
      email: "admin@example.com",
      sid: "sid-1",
      ver: 0,
    });

    await expect(verifyAdminRefreshToken(accessToken)).rejects.toThrow();
  });
});

/*
 * 어드민 토큰과 제품 토큰은 서로의 영역에서 거부돼야 한다. 시크릿이 다르므로
 * 서명 검증 단계에서 막히고, 같은 시크릿을 쓰게 되더라도 `type` claim이 한 번 더
 * 막는다. 두 방어선 중 하나라도 무너지면 어드민 권한이 제품 토큰으로 넘어간다.
 */
describe("admin and product token isolation", () => {
  const productClaims = { sub: "user-1", email: "user@example.com", sid: "sid-1", ver: 0 };
  const adminClaims = { sub: "admin-1", email: "admin@example.com", sid: "sid-1", ver: 0 };

  it("rejects a product access token in the admin realm", async () => {
    await expect(verifyAdminAccessToken(await signAccessToken(productClaims))).rejects.toThrow();
  });

  it("rejects a product refresh token in the admin realm", async () => {
    const token = await signRefreshToken({ sub: "user-1", sid: "sid-1", ver: 0 });

    await expect(verifyAdminRefreshToken(token)).rejects.toThrow();
  });

  it("rejects an admin access token in the product realm", async () => {
    await expect(verifyAccessToken(await signAdminAccessToken(adminClaims))).rejects.toThrow();
  });

  it("rejects an admin refresh token in the product realm", async () => {
    const token = await signAdminRefreshToken({ sub: "admin-1", sid: "sid-1", ver: 0 });

    await expect(verifyRefreshToken(token)).rejects.toThrow();
  });

  it("signs admin tokens with a secret the product realm does not hold", () => {
    const env = getEnv();

    expect(env.JWT_ADMIN_SECRET).not.toBe(env.JWT_SECRET);
    expect(env.JWT_ADMIN_REFRESH_SECRET).not.toBe(env.JWT_REFRESH_SECRET);
  });
});
