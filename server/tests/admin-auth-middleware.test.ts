import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { authenticate } from "@/middlewares/auth.middleware";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";

function buildAdminApp() {
  const app = express();
  app.get("/admin/protected", authenticateAdmin, (req, res) => {
    res.status(200).json({ admin: req.admin });
  });
  return app;
}

function buildProductApp() {
  const app = express();
  app.get("/protected", authenticate, (req, res) => {
    res.status(200).json({ user: req.user });
  });
  return app;
}

const adminClaims = { sub: "admin-1", email: "admin@example.com", sid: "sid-1", ver: 0 };
const productClaims = { sub: "user-1", email: "user@example.com", sid: "sid-1", ver: 0 };

describe("authenticateAdmin middleware", () => {
  it("rejects requests without a token", async () => {
    const response = await request(buildAdminApp()).get("/admin/protected");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows requests with a valid admin access token", async () => {
    const token = await signAdminAccessToken(adminClaims);

    const response = await request(buildAdminApp())
      .get("/admin/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.admin.sub).toBe("admin-1");
    expect(response.body.admin.type).toBe("admin-access");
  });

  /*
   * 제품 토큰으로 어드민 API에 들어올 수 없어야 한다. 이 한 줄이 무너지면 모든
   * 사용자가 서비스 전체의 관리 권한을 얻는다.
   */
  it("rejects a product access token", async () => {
    const token = await signAccessToken(productClaims);

    const response = await request(buildAdminApp())
      .get("/admin/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("does not populate req.user", async () => {
    const token = await signAdminAccessToken(adminClaims);

    const response = await request(buildAdminApp())
      .get("/admin/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.user).toBeUndefined();
  });

  it("rejects a tampered token", async () => {
    const token = await signAdminAccessToken(adminClaims);

    const response = await request(buildAdminApp())
      .get("/admin/protected")
      .set("Authorization", `Bearer ${token}tampered`);

    expect(response.status).toBe(401);
  });
});

describe("product authenticate middleware against admin tokens", () => {
  it("rejects an admin access token on a product route", async () => {
    const token = await signAdminAccessToken(adminClaims);

    const response = await request(buildProductApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });
});
