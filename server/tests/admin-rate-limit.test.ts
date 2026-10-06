import { describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import {
  adminLoginAccountRateLimitMiddleware,
  adminLoginRateLimitMiddleware,
  adminRefreshRateLimitMiddleware,
} from "@/middlewares/rate-limit.middleware";
import { signAdminAccessToken, signAdminRefreshToken } from "@/lib/admin-jwt";
import { ADMIN_REFRESH_TOKEN_COOKIE } from "@/utils/admin-auth-cookie";
import { useTestServer } from "./test-server";

process.env.TRUST_PROXY_HOPS = "1";

const { createApp } = await import("@/app");
const appUrl = useTestServer(() => createApp());
const loginLimiterUrl = useTestServer(() => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.post(
    "/login",
    adminLoginRateLimitMiddleware,
    adminLoginAccountRateLimitMiddleware,
    (req, res) => res.sendStatus(req.body.success ? 200 : 401),
  );
  return app;
});
const refreshLimiterUrl = useTestServer(() => {
  const app = express();
  app.use(cookieParser());
  app.post("/refresh", adminRefreshRateLimitMiddleware, (_req, res) => res.sendStatus(204));
  return app;
});

function adminIp(ip: string) {
  return request(appUrl()).post("/admin/auth/login").set("X-Forwarded-For", ip);
}

describe("어드민 rate limit", () => {
  it("로그인 실패는 IP+정규화 이메일 기준 5회/15분으로 제한하고 JSON 429를 반환한다", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await adminIp("198.51.100.10").send({
        email: " Admin@Example.com ",
        password: "",
      });
      expect(response.status).not.toBe(429);
    }

    const blocked = await adminIp("198.51.100.10").send({
      email: "admin@example.com",
      password: "",
    });

    expect(blocked.status).toBe(429);
    expect(blocked.headers["content-type"]).toMatch(/application\/json/);
    expect(blocked.headers["ratelimit-limit"]).toBeDefined();
    expect(blocked.body).toEqual({
      error: { code: "RATE_LIMIT_EXCEEDED", message: expect.any(String) },
    });
  });

  it("서로 다른 이메일도 같은 IP의 로그인 실패 10회 한도를 공유한다", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await adminIp("198.51.100.11").send({
        email: `admin-${attempt}@example.com`,
        password: "",
      });
      expect(response.status).not.toBe(429);
    }

    const blocked = await adminIp("198.51.100.11").send({
      email: "admin-last@example.com",
      password: "",
    });

    expect(blocked.status).toBe(429);
  });

  it("성공한 로그인은 IP와 계정 실패 버킷을 소모하지 않는다", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(loginLimiterUrl())
        .post("/login")
        .set("X-Forwarded-For", "198.51.100.14")
        .send({ success: true, email: "admin@example.com" });
      expect(response.status).toBe(200);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(loginLimiterUrl())
        .post("/login")
        .set("X-Forwarded-For", "198.51.100.14")
        .send({ success: false, email: "admin@example.com" });
      expect(response.status).toBe(401);
    }

    const blocked = await request(loginLimiterUrl())
      .post("/login")
      .set("X-Forwarded-For", "198.51.100.14")
      .send({ success: false, email: "admin@example.com" });

    expect(blocked.status).toBe(429);
  });

  it("인증된 조회 제한은 관리자 세션별로 분리한다", async () => {
    const firstSession = await signAdminAccessToken({
      sub: "admin-rate-test",
      email: "admin@example.com",
      sid: "admin-session-one",
      ver: 0,
    });
    const secondSession = await signAdminAccessToken({
      sub: "admin-rate-test",
      email: "admin@example.com",
      sid: "admin-session-two",
      ver: 0,
    });

    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await request(appUrl())
        .get("/admin/auth/me")
        .set("X-Forwarded-For", "198.51.100.12")
        .set("Authorization", `Bearer ${firstSession}`);
      expect(response.status).toBe(200);
    }

    const blocked = await request(appUrl())
      .get("/admin/auth/me")
      .set("X-Forwarded-For", "198.51.100.12")
      .set("Authorization", `Bearer ${firstSession}`);
    const independent = await request(appUrl())
      .get("/admin/auth/me")
      .set("X-Forwarded-For", "198.51.100.12")
      .set("Authorization", `Bearer ${secondSession}`);

    expect(blocked.status).toBe(429);
    expect(independent.status).toBe(200);
  });

  it("잘못된 어드민 refresh token은 IP 기준으로 제한한다", async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request(appUrl())
        .post("/admin/auth/refresh")
        .set("X-Forwarded-For", "198.51.100.13");
      expect(response.status).toBe(401);
    }

    const blocked = await request(appUrl())
      .post("/admin/auth/refresh")
      .set("X-Forwarded-For", "198.51.100.13");

    expect(blocked.status).toBe(429);
  });

  it("검증된 어드민 refresh token은 세션별로 제한한다", async () => {
    const firstToken = await signAdminRefreshToken({
      sub: "admin-refresh",
      sid: "admin-refresh-one",
      ver: 0,
    });
    const secondToken = await signAdminRefreshToken({
      sub: "admin-refresh",
      sid: "admin-refresh-two",
      ver: 0,
    });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await request(refreshLimiterUrl())
        .post("/refresh")
        .set("Cookie", `${ADMIN_REFRESH_TOKEN_COOKIE}=${firstToken}`);
      expect(response.status).toBe(204);
    }

    const blocked = await request(refreshLimiterUrl())
      .post("/refresh")
      .set("Cookie", `${ADMIN_REFRESH_TOKEN_COOKIE}=${firstToken}`);
    const independent = await request(refreshLimiterUrl())
      .post("/refresh")
      .set("Cookie", `${ADMIN_REFRESH_TOKEN_COOKIE}=${secondToken}`);

    expect(blocked.status).toBe(429);
    expect(independent.status).toBe(204);
  });
});
