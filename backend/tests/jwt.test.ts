import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/lib/jwt";

describe("access token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com" });
    const payload = await verifyAccessToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("user@example.com");
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com" });
    const tampered = `${token}tampered`;

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });
});
