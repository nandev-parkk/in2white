import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  getAdminByEmail,
  getAdminById,
  touchAdminLastLoginAt,
} from "@/services/admin-account.service";

vi.mock("@/db/client", () => ({
  db: {
    update: vi.fn(),
    query: {
      adminUsers: {
        findFirst: vi.fn(),
      },
    },
  },
}));

const pgDialect = new PgDialect();

const mockAdmin = {
  id: "admin-1",
  email: "admin@example.com",
  name: "Admin",
  passwordHash: "hashed-value",
  sessionVersion: 0,
  lastLoginAt: null,
  createdAt: new Date(),
};

describe("getAdminByEmail", () => {
  beforeEach(() => {
    vi.mocked(db.query.adminUsers.findFirst).mockReset();
  });

  /* 제품 `getUserByEmail`과 같은 규칙이다. 저장된 이메일의 케이스에 의존하지 않는다. */
  it("compares emails case-insensitively", async () => {
    vi.mocked(db.query.adminUsers.findFirst).mockResolvedValue(mockAdmin);

    const result = await getAdminByEmail("Admin@Example.com");

    expect(result?.id).toBe("admin-1");

    const [callArgs] = vi.mocked(db.query.adminUsers.findFirst).mock.calls;
    const { where } = callArgs[0] as { where: Parameters<typeof pgDialect.sqlToQuery>[0] };
    const rendered = pgDialect.sqlToQuery(where);

    expect(rendered.sql).toContain("lower(");
    expect(rendered.params).toContain("admin@example.com");
  });

  it("returns undefined when no admin matches", async () => {
    vi.mocked(db.query.adminUsers.findFirst).mockResolvedValue(undefined);

    await expect(getAdminByEmail("nobody@example.com")).resolves.toBeUndefined();
  });
});

describe("getAdminById", () => {
  beforeEach(() => {
    vi.mocked(db.query.adminUsers.findFirst).mockReset();
  });

  it("looks the admin up by primary key", async () => {
    vi.mocked(db.query.adminUsers.findFirst).mockResolvedValue(mockAdmin);

    await expect(getAdminById("admin-1")).resolves.toMatchObject({ id: "admin-1" });

    const [callArgs] = vi.mocked(db.query.adminUsers.findFirst).mock.calls;
    const { where } = callArgs[0] as { where: Parameters<typeof pgDialect.sqlToQuery>[0] };
    const rendered = pgDialect.sqlToQuery(where);

    expect(rendered.params).toContain("admin-1");
  });
});

describe("touchAdminLastLoginAt", () => {
  beforeEach(() => {
    vi.mocked(db.update).mockReset();
  });

  it("writes the given timestamp onto the admin row", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn().mockReturnValue({ where });
    vi.mocked(db.update).mockReturnValue({ set } as unknown as ReturnType<typeof db.update>);

    const loggedInAt = new Date("2026-10-01T00:00:00.000Z");
    await touchAdminLastLoginAt("admin-1", loggedInAt);

    expect(set).toHaveBeenCalledWith({ lastLoginAt: loggedInAt });
    expect(where).toHaveBeenCalledTimes(1);
  });
});
