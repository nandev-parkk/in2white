import { describe, expect, it } from "vitest";
import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import {
  productLoginRateLimitMiddlewares,
  productRefreshRateLimitMiddleware,
} from "@/middlewares/rate-limit.middleware";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { REFRESH_TOKEN_COOKIE } from "@/utils/auth-cookie";
import { useTestServer } from "./test-server";

process.env.TRUST_PROXY_HOPS = "1";

const { createApp } = await import("@/app");
const appUrl = useTestServer(() => createApp());
const loginLimiterUrl = useTestServer(() => {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.post("/login", ...productLoginRateLimitMiddlewares, (req, res) =>
    res.sendStatus(req.body.success ? 200 : 401),
  );
  return app;
});
const refreshLimiterUrl = useTestServer(() => {
  const app = express();
  app.use(cookieParser());
  app.post("/refresh", productRefreshRateLimitMiddleware, (_req, res) => res.sendStatus(204));
  return app;
});

describe("제품 API rate limit", () => {
  it("로그인 실패는 IP+정규화 이메일 기준 5회/15분으로 제한한다", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(appUrl())
        .post("/auth/login")
        .set("X-Forwarded-For", "198.51.100.20")
        .send({ email: " User@Example.com ", password: "" });
      expect(response.status).not.toBe(429);
    }

    const blocked = await request(appUrl())
      .post("/auth/login")
      .set("X-Forwarded-For", "198.51.100.20")
      .send({ email: "user@example.com", password: "" });

    expect(blocked.status).toBe(429);
    expect(blocked.headers["ratelimit-limit"]).toBeDefined();
  });

  it("성공한 로그인은 IP와 계정 실패 버킷을 소모하지 않는다", async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(loginLimiterUrl())
        .post("/login")
        .set("X-Forwarded-For", "198.51.100.25")
        .send({ success: true, email: "user@example.com" });
      expect(response.status).toBe(200);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(loginLimiterUrl())
        .post("/login")
        .set("X-Forwarded-For", "198.51.100.25")
        .send({ success: false, email: "user@example.com" });
      expect(response.status).toBe(401);
    }

    const blocked = await request(loginLimiterUrl())
      .post("/login")
      .set("X-Forwarded-For", "198.51.100.25")
      .send({ success: false, email: "user@example.com" });

    expect(blocked.status).toBe(429);
  });

  it("서로 다른 이메일도 같은 IP의 로그인 실패 60회 한도를 공유한다", async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request(appUrl())
        .post("/auth/login")
        .set("X-Forwarded-For", "198.51.100.21")
        .send({ email: `user-${attempt}@example.com`, password: "" });
      expect(response.status).not.toBe(429);
    }

    const blocked = await request(appUrl())
      .post("/auth/login")
      .set("X-Forwarded-For", "198.51.100.21")
      .send({ email: "user-last@example.com", password: "" });

    expect(blocked.status).toBe(429);
  });

  it("인증된 변경 API 한도는 공인 IP가 아니라 sub:sid 세션별로 적용한다", async () => {
    const firstSession = await signAccessToken({
      sub: "user-rate-test",
      email: "user@example.com",
      sid: "session-one",
      ver: 0,
    });
    const secondSession = await signAccessToken({
      sub: "user-rate-test",
      email: "user@example.com",
      sid: "session-two",
      ver: 0,
    });

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request(appUrl())
        .patch("/account")
        .set("X-Forwarded-For", "198.51.100.22")
        .set("Authorization", `Bearer ${firstSession}`)
        .send({});
      expect(response.status).toBe(400);
    }

    const blocked = await request(appUrl())
      .patch("/account")
      .set("X-Forwarded-For", "198.51.100.22")
      .set("Authorization", `Bearer ${firstSession}`)
      .send({});
    const independent = await request(appUrl())
      .patch("/account")
      .set("X-Forwarded-For", "198.51.100.22")
      .set("Authorization", `Bearer ${secondSession}`)
      .send({});

    expect(blocked.status).toBe(429);
    expect(independent.status).toBe(400);
  });

  it("비밀번호 변경 실패는 세션당 10회/15분으로 제한한다", async () => {
    const token = await signAccessToken({
      sub: "user-password-rate-test",
      email: "user@example.com",
      sid: "password-session-one",
      ver: 0,
    });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(appUrl())
        .patch("/account/password")
        .set("X-Forwarded-For", "198.51.100.26")
        .set("Authorization", `Bearer ${token}`)
        .send({});
      expect(response.status).toBe(400);
    }

    const blocked = await request(appUrl())
      .patch("/account/password")
      .set("X-Forwarded-For", "198.51.100.26")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(blocked.status).toBe(429);
  });

  it("잘못된 refresh token은 IP 기준으로 제한한다", async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request(appUrl())
        .post("/auth/refresh")
        .set("X-Forwarded-For", "198.51.100.23");
      expect(response.status).toBe(401);
    }

    const blocked = await request(appUrl())
      .post("/auth/refresh")
      .set("X-Forwarded-For", "198.51.100.23");

    expect(blocked.status).toBe(429);
  });

  it("검증된 refresh token은 사용자 세션별로 제한한다", async () => {
    const firstToken = await signRefreshToken({ sub: "user-refresh", sid: "refresh-one", ver: 0 });
    const secondToken = await signRefreshToken({ sub: "user-refresh", sid: "refresh-two", ver: 0 });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await request(refreshLimiterUrl())
        .post("/refresh")
        .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${firstToken}`);
      expect(response.status).toBe(204);
    }

    const blocked = await request(refreshLimiterUrl())
      .post("/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${firstToken}`);
    const independent = await request(refreshLimiterUrl())
      .post("/refresh")
      .set("Cookie", `${REFRESH_TOKEN_COOKIE}=${secondToken}`);

    expect(blocked.status).toBe(429);
    expect(independent.status).toBe(204);
  });

  it("/health는 사용자 요청 횟수 제한에서 제외한다", async () => {
    for (let attempt = 0; attempt < 110; attempt += 1) {
      const response = await request(appUrl())
        .get("/health/")
        .set("X-Forwarded-For", "198.51.100.24");
      expect(response.status).toBe(200);
    }
  });
});
