import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authenticate } from "@/middlewares/auth.middleware";
import { signAccessToken } from "@/lib/jwt";

function buildTestApp() {
  const app = express();
  app.get("/protected", authenticate, (req, res) => {
    res.status(200).json({ user: req.user });
  });
  return app;
}

describe("authenticate middleware", () => {
  it("rejects requests without a token", async () => {
    const response = await request(buildTestApp()).get("/protected");
    expect(response.status).toBe(401);
  });

  it("allows requests with a valid token", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });
    const response = await request(buildTestApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.sub).toBe("user-1");
  });
});
