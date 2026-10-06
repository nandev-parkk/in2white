import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { adminUsers } from "@/db/schema";
import {
  createAdminUser,
  getAdminByEmail,
  getAdminById,
  hasAdminUsers,
  touchAdminLastLoginAt,
} from "@/services/admin-account.service";

vi.mock("@/db/client", () => ({
  db: {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    transaction: vi.fn(),
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

function mockCreateTransaction({
  existingRows = [] as unknown[],
  insertedRows = [mockAdmin] as unknown[],
} = {}) {
  const existingQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(existingRows),
  };
  const insertQuery = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(insertedRows),
  };
  const tx = {
    select: vi.fn().mockReturnValue(existingQuery),
    insert: vi.fn().mockReturnValue(insertQuery),
  };
  vi.mocked(db.transaction).mockImplementation((async (callback: (handle: unknown) => unknown) =>
    callback(tx)) as unknown as typeof db.transaction);

  return { tx, existingQuery, insertQuery };
}

describe("createAdminUser", () => {
  beforeEach(() => {
    vi.mocked(db.transaction).mockReset();
  });

  /*
   * `admin_users.email`의 unique 제약은 대소문자를 구분한다. 정규화하지 않고 넣으면
   * `Admin@x`와 `admin@x`가 동시에 존재하고, 로그인 조회는 둘 중 하나를 임의로 고른다.
   */
  it("stores the email lower-cased and returns the created row", async () => {
    const { tx, insertQuery } = mockCreateTransaction();

    await expect(
      createAdminUser({
        email: "  Admin@Example.com ",
        name: "Admin",
        passwordHash: "hashed-value",
      }),
    ).resolves.toMatchObject({ id: "admin-1" });

    expect(tx.insert).toHaveBeenCalledWith(adminUsers);
    expect(insertQuery.values).toHaveBeenCalledWith({
      email: "admin@example.com",
      name: "Admin",
      passwordHash: "hashed-value",
    });
  });

  it("rejects an email that already exists in a different case", async () => {
    const { insertQuery, existingQuery } = mockCreateTransaction({
      existingRows: [{ id: "admin-1" }],
    });

    await expect(
      createAdminUser({
        email: "ADMIN@example.com",
        name: "Admin",
        passwordHash: "hashed-value",
      }),
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_ALREADY_EXISTS" });

    const [callArgs] = existingQuery.where.mock.calls;
    const rendered = pgDialect.sqlToQuery(
      callArgs[0] as Parameters<typeof pgDialect.sqlToQuery>[0],
    );
    expect(rendered.sql).toContain("lower(");
    expect(rendered.params).toContain("admin@example.com");
    expect(insertQuery.values).not.toHaveBeenCalled();
  });

  /* 사전 조회와 insert 사이에 다른 프로세스가 같은 이메일을 넣는 경합도 같은 실패다. */
  it("rejects when the unique constraint discards the insert", async () => {
    mockCreateTransaction({ insertedRows: [] });

    await expect(
      createAdminUser({
        email: "admin@example.com",
        name: "Admin",
        passwordHash: "hashed-value",
      }),
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_ALREADY_EXISTS" });
  });
});

describe("hasAdminUsers", () => {
  beforeEach(() => {
    vi.mocked(db.query.adminUsers.findFirst).mockReset();
  });

  it("returns true when an administrator already exists", async () => {
    vi.mocked(db.query.adminUsers.findFirst).mockResolvedValue(mockAdmin);

    await expect(hasAdminUsers()).resolves.toBe(true);
    expect(db.query.adminUsers.findFirst).toHaveBeenCalledWith({
      columns: { id: true },
    });
  });

  it("returns false when the administrator table is empty", async () => {
    vi.mocked(db.query.adminUsers.findFirst).mockResolvedValue(undefined);

    await expect(hasAdminUsers()).resolves.toBe(false);
  });
});
