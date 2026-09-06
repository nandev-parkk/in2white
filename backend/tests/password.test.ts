import { describe, expect, it } from "vitest";
import { comparePassword, compareDummyPassword, hashPassword } from "@/lib/password";

describe("password", () => {
  it("hashes and verifies a matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");

    await expect(comparePassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");

    await expect(comparePassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const hashA = await hashPassword("same-password");
    const hashB = await hashPassword("same-password");

    expect(hashA).not.toBe(hashB);
  });

  it("compareDummyPassword resolves without throwing regardless of input", async () => {
    await expect(compareDummyPassword("anything")).resolves.toBeUndefined();
  });
});
