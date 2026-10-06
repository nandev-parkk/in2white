import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";

const appUrl = useTestServer(() => createApp());

describe("createApp", () => {
  it("returns 404 for unknown routes", async () => {
    const response = await request(appUrl()).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("mounts the authenticated account router", async () => {
    const response = await request(appUrl()).get("/account");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows credentialed requests from the configured CORS origin", async () => {
    const response = await request(appUrl())
      .options("/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("does not store the whiteboard deletion hook in app.locals", () => {
    const app = createApp({ onWhiteboardDocumentDeleted: () => undefined });

    expect(app.locals.onWhiteboardDocumentDeleted).toBeUndefined();
  });
});
