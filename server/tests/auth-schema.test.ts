import { describe, expect, it } from "vitest";
import { ERROR_MESSAGES } from "@/constants/messages";
import { loginSchema } from "@/schemas/auth.schema";

describe("loginSchema", () => {
  it("accepts a valid email/password payload", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "Secret123!" });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret123" });

    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(ERROR_MESSAGES.PASSWORD_REQUIRED);
    }
  });

  it("rejects a missing password field", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(ERROR_MESSAGES.PASSWORD_REQUIRED);
    }
  });

  it.each([
    ["shorter than eight characters", "Se1!", ERROR_MESSAGES.PASSWORD_TOO_SHORT],
    ["longer than 32 characters", `${"a".repeat(31)}A1!`, ERROR_MESSAGES.PASSWORD_TOO_LONG],
    ["missing a letter", "12345678!", ERROR_MESSAGES.PASSWORD_MISSING_LETTER],
    ["missing a number", "Password!", ERROR_MESSAGES.PASSWORD_MISSING_NUMBER],
    ["missing a special character", "Secret123", ERROR_MESSAGES.PASSWORD_MISSING_SPECIAL_CHAR],
  ])("rejects a password %s", (_reason, password, _message) => {
    const result = loginSchema.safeParse({ email: "user@example.com", password });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("비밀번호를 정확히 입력해주세요");
    }
  });
});
