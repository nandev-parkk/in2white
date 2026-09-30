import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";

const appUrl = useTestServer(() => createApp());

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const response = await request(appUrl()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
