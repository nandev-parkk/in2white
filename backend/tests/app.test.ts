import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

describe("createApp", () => {
  it("returns 404 for unknown routes", async () => {
    const response = await request(createApp()).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
