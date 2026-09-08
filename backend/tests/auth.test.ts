import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import type { Response as SupertestResponse } from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { db } from "@/db/client";
import { valkey } from "@/cache/valkey";
import { ERROR_MESSAGES } from "@/constants/messages";
import { hashPassword } from "@/lib/password";
import { authRouter } from "@/routes/auth.routes";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";

vi.mock("@/db/client", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/cache/valkey", () => ({
  valkey: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  },
}));

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/auth", authRouter);
  app.use(errorHandlerMiddleware);
  return app;
}

function extractCookie(response: SupertestResponse, name: string): string | undefined {
  const raw = response.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(`${name}=`));
  return cookie?.split(";")[0]?.split("=")[1];
}

function extractSetCookieHeader(response: SupertestResponse, name: string): string | undefined {
  const raw = response.headers["set-cookie"] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
}

// 실제 Valkey Lua 엔진 없이, session.service.ts의 ROTATE_SCRIPT가 하는
// compare-and-set 동작을 in-memory Map으로 재현해 valkey.set/get/del/eval을 연결한다.
// 여러 sid(기기) 간 세션이 서로 독립적인지도 이 store 하나로 검증할 수 있다.
function wireValkeyMock(store: Map<string, string>) {
  vi.mocked(valkey.set).mockImplementation((async (key: string, value: string) => {
    store.set(key, value);
    return "OK";
  }) as typeof valkey.set);

  vi.mocked(valkey.get).mockImplementation(
    (async (key: string) => store.get(key) ?? null) as typeof valkey.get,
  );

  vi.mocked(valkey.del).mockImplementation((async (key: string) => {
    const existed = store.delete(key);
    return existed ? 1 : 0;
  }) as typeof valkey.del);

  vi.mocked(valkey.eval).mockImplementation((async (
    _script: string,
    _numKeys: number,
    key: string,
    expectedHash: string,
    newHash: string,
  ) => {
    if (store.get(key) !== expectedHash) {
      return 0;
    }
    store.set(key, newHash);
    return 1;
  }) as typeof valkey.eval);
}

const seededUser = {
  id: "user-1",
  name: "Test User",
  email: "user@example.com",
  createdAt: new Date(),
};

describe("POST /auth/login", () => {
  beforeEach(() => {
    vi.mocked(db.query.users.findFirst).mockReset();
    vi.mocked(valkey.set).mockReset();
    vi.mocked(valkey.get).mockReset();
    vi.mocked(valkey.del).mockReset();
    vi.mocked(valkey.eval).mockReset();
  });

  it("returns 401 for a non-existent account", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "missing@example.com", password: "Whatever123!" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for a wrong password", async () => {
    const passwordHash = await hashPassword("Correct123!");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });

    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Wrong123!" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "not-an-email", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when the password violates the password policy", async () => {
    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Password123" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.message).toBe(ERROR_MESSAGES.PASSWORD_INVALID);
    expect(db.query.users.findFirst).not.toHaveBeenCalled();
  });

  it("returns accessToken/user in the body and refreshToken only as a cookie", async () => {
    const passwordHash = await hashPassword("Correct123!");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });
    wireValkeyMock(new Map());

    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Correct123!" });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.user).toEqual({
      id: "user-1",
      name: "Test User",
      email: "user@example.com",
    });
    expect(extractCookie(response, "refreshToken")).toBeTruthy();

    const setCookieHeader = extractSetCookieHeader(response, "refreshToken");
    expect(setCookieHeader).toMatch(/HttpOnly/i);
    expect(setCookieHeader).toMatch(/SameSite=Lax/i);
    expect(setCookieHeader).toMatch(/Path=\/auth\/refresh/i);
    expect(setCookieHeader).toMatch(/Max-Age=\d+/i);
    // NODE_ENV=test이므로 secure:false로 서명된다 — Secure 속성이 없어야 한다.
    expect(setCookieHeader).not.toMatch(/;\s*Secure/i);
  });

  it("keeps two devices logged in independently (multi-session)", async () => {
    const passwordHash = await hashPassword("Correct123!");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });
    wireValkeyMock(new Map());
    const app = buildTestApp();

    const deviceALogin = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Correct123!" });
    const deviceBLogin = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Correct123!" });

    const deviceACookie = extractCookie(deviceALogin, "refreshToken") as string;
    const deviceBCookie = extractCookie(deviceBLogin, "refreshToken") as string;
    expect(deviceACookie).not.toBe(deviceBCookie);

    const deviceARefresh = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${deviceACookie}`]);
    expect(deviceARefresh.status).toBe(200);

    // A 기기가 회전해도 B 기기의 기존 세션은 여전히 살아있어야 한다.
    const deviceBRefresh = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${deviceBCookie}`]);
    expect(deviceBRefresh.status).toBe(200);
  });

  it("logging out one device does not affect another device's session", async () => {
    const passwordHash = await hashPassword("Correct123!");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });
    wireValkeyMock(new Map());
    const app = buildTestApp();

    const deviceALogin = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Correct123!" });
    const deviceBLogin = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Correct123!" });

    const deviceAAccessToken = deviceALogin.body.accessToken as string;
    const deviceBCookie = extractCookie(deviceBLogin, "refreshToken") as string;

    const deviceALogout = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${deviceAAccessToken}`);
    expect(deviceALogout.status).toBe(204);

    // A 기기 로그아웃이 B 기기의 세션에는 영향을 주지 않아야 한다.
    const deviceBRefresh = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${deviceBCookie}`]);
    expect(deviceBRefresh.status).toBe(200);
  });
});

describe("POST /auth/refresh and /auth/logout", () => {
  beforeEach(() => {
    vi.mocked(db.query.users.findFirst).mockReset();
    vi.mocked(valkey.set).mockReset();
    vi.mocked(valkey.get).mockReset();
    vi.mocked(valkey.del).mockReset();
    vi.mocked(valkey.eval).mockReset();
  });

  async function loginAndGetApp() {
    const passwordHash = await hashPassword("Correct123!");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });
    wireValkeyMock(new Map());

    const app = buildTestApp();
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "Correct123!" });

    return {
      app,
      accessToken: loginResponse.body.accessToken as string,
      refreshCookie: extractCookie(loginResponse, "refreshToken") as string,
    };
  }

  it("returns 401 when no refreshToken cookie is sent", async () => {
    const response = await request(buildTestApp()).post("/auth/refresh");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rotates tokens on refresh and rejects the old refreshToken afterwards", async () => {
    const { app, refreshCookie } = await loginAndGetApp();

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    const rotatedCookie = extractCookie(refreshResponse, "refreshToken");
    expect(rotatedCookie).toBeTruthy();
    expect(rotatedCookie).not.toBe(refreshCookie);

    const staleResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);

    expect(staleResponse.status).toBe(401);
    expect(staleResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("replaying an already-rotated refreshToken kills the whole session (reuse detection)", async () => {
    const { app, refreshCookie } = await loginAndGetApp();

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);
    const rotatedCookie = extractCookie(refreshResponse, "refreshToken") as string;

    // 이미 회전되어 폐기된 최초 refreshToken을 다시 제시한다(탈취/재시도 시나리오).
    const replayResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);
    expect(replayResponse.status).toBe(401);

    // 방금 정상적으로 회전되어 유효했던 토큰까지도 세션 전체 폐기로 함께 무효화된다.
    const rotatedTokenResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${rotatedCookie}`]);
    expect(rotatedTokenResponse.status).toBe(401);
  });

  it("rejects refresh when the Origin header does not match CORS_ORIGIN", async () => {
    const { app, refreshCookie } = await loginAndGetApp();

    const response = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`])
      .set("Origin", "http://evil.example.com");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INVALID_ORIGIN");
  });

  it("logs out and invalidates the session so refresh fails afterwards", async () => {
    const { app, accessToken, refreshCookie } = await loginAndGetApp();

    const logoutResponse = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logoutResponse.status).toBe(204);

    const refreshAfterLogout = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);

    expect(refreshAfterLogout.status).toBe(401);
  });

  it("returns 401 from logout without a bearer token", async () => {
    const response = await request(buildTestApp()).post("/auth/logout");

    expect(response.status).toBe(401);
  });
});
