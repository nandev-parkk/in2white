import { describe, expect, it } from "vitest";
import { loginSchema } from "@/schemas/auth.schema";

describe("loginSchema", () => {
  it("accepts a valid email/password payload", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "secret123" });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret123" });

    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing password field", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" });

    expect(result.success).toBe(false);
  });
});
