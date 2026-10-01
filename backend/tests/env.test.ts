import { describe, expect, it } from "vitest";
import { parseEnv } from "@/config/env";

describe("parseEnv", () => {
  const validSource = {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    VALKEY_URL: "redis://localhost:6379",
    JWT_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
    JWT_ADMIN_SECRET: "c".repeat(32),
    JWT_ADMIN_REFRESH_SECRET: "d".repeat(32),
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

  it("applies a default for ADMIN_CORS_ORIGIN", () => {
    const result = parseEnv(validSource);
    expect(result.ADMIN_CORS_ORIGIN).toBe("http://localhost:5174");
  });

  it("throws when JWT_ADMIN_SECRET is missing", () => {
    const { JWT_ADMIN_SECRET: _drop, ...rest } = validSource;
    expect(() => parseEnv(rest)).toThrow(/JWT_ADMIN_SECRET/);
  });

  it("throws when JWT_ADMIN_REFRESH_SECRET is missing", () => {
    const { JWT_ADMIN_REFRESH_SECRET: _drop, ...rest } = validSource;
    expect(() => parseEnv(rest)).toThrow(/JWT_ADMIN_REFRESH_SECRET/);
  });

  /*
   * 어드민 토큰과 제품 토큰은 서로의 영역에서 거부돼야 한다. 시크릿을 공유하면
   * 서명 검증이 통과해버려서 `type` claim 검사만이 유일한 방어선으로 남는다.
   */
  it("throws when an admin secret matches a product secret", () => {
    expect(() => parseEnv({ ...validSource, JWT_ADMIN_SECRET: validSource.JWT_SECRET })).toThrow(
      /JWT_ADMIN_SECRET/,
    );
    expect(() =>
      parseEnv({ ...validSource, JWT_ADMIN_REFRESH_SECRET: validSource.JWT_REFRESH_SECRET }),
    ).toThrow(/JWT_ADMIN_REFRESH_SECRET/);
  });

  it("throws when the two admin secrets are the same", () => {
    expect(() =>
      parseEnv({ ...validSource, JWT_ADMIN_REFRESH_SECRET: validSource.JWT_ADMIN_SECRET }),
    ).toThrow(/JWT_ADMIN_REFRESH_SECRET/);
  });
});
