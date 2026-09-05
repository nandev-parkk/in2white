import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const app = createApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
