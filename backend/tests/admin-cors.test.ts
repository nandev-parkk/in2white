import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { getEnv } from "@/config/env";
import { useTestServer } from "./test-server";

const appUrl = useTestServer(() => createApp());

const productOrigin = getEnv().CORS_ORIGIN;
const adminOrigin = getEnv().ADMIN_CORS_ORIGIN;

/*
 * 두 오리진을 앱 전역에 모두 허용하면 제품 API가 어드민 콘솔에서 호출 가능해지고,
 * 어드민 API가 제품 프런트엔드에서 호출 가능해진다. 경로별로 하나씩만 허용한다.
 */
describe("CORS 격리", () => {
  it("어드민 경로는 어드민 오리진을 허용한다", async () => {
    const response = await request(appUrl())
      .options("/admin/auth/login")
      .set("Origin", adminOrigin)
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBe(adminOrigin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("어드민 경로에 제품 오리진을 허용하지 않는다", async () => {
    const response = await request(appUrl())
      .options("/admin/auth/login")
      .set("Origin", productOrigin)
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).not.toBe(productOrigin);
  });

  it("제품 경로에 어드민 오리진을 허용하지 않는다", async () => {
    const response = await request(appUrl())
      .options("/auth/login")
      .set("Origin", adminOrigin)
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).not.toBe(adminOrigin);
  });

  it("제품 경로는 제품 오리진을 그대로 허용한다", async () => {
    const response = await request(appUrl())
      .options("/auth/login")
      .set("Origin", productOrigin)
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBe(productOrigin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  /*
   * rate limit에 걸린 응답도 브라우저가 읽을 수 있어야 한다. CORS가 rate limit보다
   * 뒤에 오면 429에 CORS 헤더가 붙지 않아 어드민 콘솔이 이유를 표시할 수 없다.
   */
  it("본문 응답에도 오리진별 CORS 헤더가 붙는다", async () => {
    const response = await request(appUrl()).get("/admin/auth/me").set("Origin", adminOrigin);

    expect(response.status).toBe(401);
    expect(response.headers["access-control-allow-origin"]).toBe(adminOrigin);
  });
});

describe("어드민 라우터 마운트", () => {
  it("인증이 필요한 어드민 엔드포인트는 토큰 없이 401을 준다", async () => {
    const response = await request(appUrl()).get("/admin/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("없는 어드민 경로는 404를 준다", async () => {
    const response = await request(appUrl()).get("/admin/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
