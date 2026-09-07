import { describe, expect, it } from "vitest";
import { parseEnv } from "@/config/env";

describe("parseEnv", () => {
  const validSource = {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    VALKEY_URL: "redis://localhost:6379",
    JWT_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
  };

  it("applies defaults for NODE_ENV and PORT", () => {
    const result = parseEnv(validSource);
    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(4000);
  });

  it("applies a default for CORS_ORIGIN", () => {
    const result = parseEnv(validSource);
    expect(result.CORS_ORIGIN).toBe("http://localhost:5173");
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL: _drop, ...rest } = validSource;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when JWT_SECRET is too short", () => {
    expect(() => parseEnv({ ...validSource, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_REFRESH_SECRET is too short", () => {
    expect(() => parseEnv({ ...validSource, JWT_REFRESH_SECRET: "short" })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
  });
});
