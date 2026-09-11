import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

describe("createApp", () => {
  it("returns 404 for unknown routes", async () => {
    const response = await request(createApp()).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("mounts the authenticated account router", async () => {
    const response = await request(createApp()).get("/account");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows credentialed requests from the configured CORS origin", async () => {
    const response = await request(createApp())
      .options("/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
});
