import { describe, expect, it } from "vitest";
import { changePasswordSchema, updateAccountSchema } from "@/schemas/account.schema";

describe("account schemas", () => {
  it("trims and validates an account name", () => {
    expect(updateAccountSchema.parse({ name: "  새 이름  " })).toEqual({ name: "새 이름" });
    expect(updateAccountSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(updateAccountSchema.safeParse({ name: "a".repeat(256) }).success).toBe(false);
  });

  it("validates current and new passwords with the existing password policy", () => {
    expect(
      changePasswordSchema.parse({ currentPassword: "Old123!", newPassword: "New12345!" }),
    ).toEqual({ currentPassword: "Old123!", newPassword: "New12345!" });
    expect(
      changePasswordSchema.safeParse({ currentPassword: "", newPassword: "New12345!" }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({ currentPassword: "Old123!", newPassword: "weak" }).success,
    ).toBe(false);
  });
});
