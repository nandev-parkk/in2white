import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { ADMIN_LOGIN_RATE_LIMIT, PRODUCT_RATE_LIMIT } from "@/middlewares/rate-limit.middleware";
import { useTestServer } from "./test-server";

const appUrl = useTestServer(() => createApp());

/*
 * 어드민 계정은 수가 적고 하나만 뚫려도 서비스 전체 권한이 넘어간다. 제품 로그인과
 * 같은 버킷을 쓰면 무차별 대입 시도 예산이 지나치게 넉넉해진다.
 */
describe("어드민 로그인 rate limit", () => {
  it("제품 버킷보다 엄격하다", () => {
    expect(ADMIN_LOGIN_RATE_LIMIT.limit).toBeLessThan(PRODUCT_RATE_LIMIT.limit);
  });

  it("버킷을 넘기면 429를 준다", async () => {
    // 검증 실패(400)로 끝나는 본문을 써서 DB를 건드리지 않고 카운터만 소진한다.
    for (let attempt = 0; attempt < ADMIN_LOGIN_RATE_LIMIT.limit; attempt += 1) {
      const response = await request(appUrl()).post("/admin/auth/login").send({});
      expect(response.status).not.toBe(429);
    }

    const blocked = await request(appUrl()).post("/admin/auth/login").send({});

    expect(blocked.status).toBe(429);
    expect(blocked.headers["content-type"]).toMatch(/application\/json/);
    expect(blocked.body).toEqual({
      error: { code: "RATE_LIMIT_EXCEEDED", message: expect.any(String) },
    });
  });

  it("어드민 로그인 버킷이 다른 어드민 경로까지 막지는 않는다", async () => {
    const response = await request(appUrl()).get("/admin/auth/me");

    expect(response.status).toBe(401);
  });
});
