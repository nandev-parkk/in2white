import { describe, expect, it, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { users, workspaceMemberships, workspaces } from "@/db/schema";
import {
  getUserByEmail,
  getUserById,
  updateUserName,
  updateUserPasswordAndIncrementSessionVersion,
  upsertUserWithDefaultWorkspace,
} from "@/services/user.service";

vi.mock("@/db/client", () => ({
  db: {
    update: vi.fn(),
    transaction: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, eq: vi.fn(actual.eq) };
});

const pgDialect = new PgDialect();

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "user@example.com",
  passwordHash: "hashed-value",
  createdAt: new Date(),
};

describe("getUserByEmail", () => {
  beforeEach(() => {
    vi.mocked(db.query.users.findFirst).mockReset();
    vi.mocked(db.transaction).mockReset();
    vi.mocked(eq).mockClear();
  });

  it("compares emails case-insensitively so DB-stored casing never matters", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);

    const result = await getUserByEmail("User@Example.com");

    expect(result?.id).toBe("user-1");

    const [callArgs] = vi.mocked(db.query.users.findFirst).mock.calls;
    const { where } = callArgs[0] as { where: Parameters<typeof pgDialect.sqlToQuery>[0] };
    const rendered = pgDialect.sqlToQuery(where);

    // lower(email) = $1 — not eq(email, ...) — so a differently-cased value
    // already stored in the DB still matches, instead of relying on the
    // stored row already being lowercase.
    expect(rendered.sql).toBe('lower("users"."email") = $1');
    expect(rendered.params).toEqual(["user@example.com"]);
  });

  it("trims and lowercases the input before building the query", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);

    await getUserByEmail("  Weird.Casing@EXAMPLE.com  ");

    const [callArgs] = vi.mocked(db.query.users.findFirst).mock.calls;
    const { where } = callArgs[0] as { where: Parameters<typeof pgDialect.sqlToQuery>[0] };
    const rendered = pgDialect.sqlToQuery(where);

    expect(rendered.params).toEqual(["weird.casing@example.com"]);
  });

  it("returns undefined when the user is not found", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

    const result = await getUserByEmail("missing@example.com");

    expect(result).toBeUndefined();
  });
});

describe("getUserById", () => {
  beforeEach(() => {
    vi.mocked(db.query.users.findFirst).mockReset();
    vi.mocked(eq).mockClear();
  });

  it("queries by id", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);

    const result = await getUserById("user-1");

    expect(result?.email).toBe("user@example.com");
    expect(eq).toHaveBeenCalledWith(users.id, "user-1");
  });
});

describe("upsertUserWithDefaultWorkspace", () => {
  const defaultWorkspace = {
    id: "workspace-default",
    name: "My Workspace",
    ownerId: "user-1",
    isDefault: true,
    createdAt: new Date("2026-09-08T00:00:00.000Z"),
    updatedAt: new Date("2026-09-08T00:00:00.000Z"),
  };

  function mockProvisioningTransaction({
    defaultWorkspaceRows = [],
    workspaceRows = [defaultWorkspace],
    membershipError,
  }: {
    defaultWorkspaceRows?: unknown[];
    workspaceRows?: unknown[];
    membershipError?: Error;
  } = {}) {
    const userInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockUser]),
    };
    const workspaceQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(defaultWorkspaceRows),
    };
    const workspaceInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(workspaceRows),
    };
    const membershipInsert = {
      values: vi.fn().mockReturnThis(),
      onConflictDoUpdate: membershipError
        ? vi.fn().mockRejectedValue(membershipError)
        : vi.fn().mockResolvedValue([]),
    };
    const transaction = {
      insert: vi.fn((table: unknown) => {
        if (table === users) return userInsert;
        if (table === workspaces) return workspaceInsert;
        return membershipInsert;
      }),
      select: vi.fn().mockReturnValue(workspaceQuery),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );

    return { membershipInsert, transaction, userInsert, workspaceInsert, workspaceQuery };
  }

  it("creates a default workspace and owner membership for a new user", async () => {
    const { membershipInsert, transaction, userInsert, workspaceInsert } =
      mockProvisioningTransaction();

    await upsertUserWithDefaultWorkspace({
      email: "user@example.com",
      name: "Test User",
      passwordHash: "hashed-value",
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(userInsert.values).toHaveBeenCalledWith({
      email: "user@example.com",
      name: "Test User",
      passwordHash: "hashed-value",
    });
    expect(userInsert.onConflictDoUpdate).toHaveBeenCalledWith({
      target: users.email,
      set: { name: "Test User", passwordHash: "hashed-value" },
    });
    expect(workspaceInsert.values).toHaveBeenCalledWith({
      name: "My Workspace",
      ownerId: "user-1",
      isDefault: true,
    });
    expect(membershipInsert.values).toHaveBeenCalledWith({
      workspaceId: "workspace-default",
      userId: "user-1",
      role: "owner",
    });
    expect(transaction.insert).toHaveBeenCalledWith(users);
    expect(transaction.insert).toHaveBeenCalledWith(workspaces);
    expect(transaction.insert).toHaveBeenCalledWith(workspaceMemberships);
  });

  it("repairs a user who is missing the default workspace", async () => {
    const { workspaceInsert } = mockProvisioningTransaction({ defaultWorkspaceRows: [] });

    await upsertUserWithDefaultWorkspace({
      email: "test@example.com",
      name: "테스트유저",
      passwordHash: "hashed-value",
    });

    expect(workspaceInsert.values).toHaveBeenCalledWith({
      name: "My Workspace",
      ownerId: "user-1",
      isDefault: true,
    });
  });

  it("does not create a duplicate workspace when the default already exists", async () => {
    const { membershipInsert, workspaceInsert } = mockProvisioningTransaction({
      defaultWorkspaceRows: [defaultWorkspace],
    });

    await upsertUserWithDefaultWorkspace({
      email: "user@example.com",
      name: "Test User",
      passwordHash: "hashed-value",
    });

    expect(workspaceInsert.values).not.toHaveBeenCalled();
    expect(membershipInsert.values).toHaveBeenCalledWith({
      workspaceId: "workspace-default",
      userId: "user-1",
      role: "owner",
    });
  });

  it("propagates membership errors so the transaction can roll back", async () => {
    const membershipError = new Error("membership insert failed");
    mockProvisioningTransaction({ membershipError });

    await expect(
      upsertUserWithDefaultWorkspace({
        email: "user@example.com",
        name: "Test User",
        passwordHash: "hashed-value",
      }),
    ).rejects.toBe(membershipError);
  });
});

describe("account user updates", () => {
  beforeEach(() => {
    vi.mocked(db.update).mockReset();
  });

  function mockUpdateReturning(row: unknown) {
    const returning = vi.fn().mockResolvedValue(row ? [row] : []);
    const where = vi.fn().mockReturnValue({ returning });
    const set = vi.fn().mockReturnValue({ where });
    vi.mocked(db.update).mockReturnValue({ set } as never);
    return { returning, set, where };
  }

  it("updates a user's name and returns the updated row", async () => {
    const { set, where } = mockUpdateReturning({ ...mockUser, name: "새 이름" });

    const result = await updateUserName({ userId: "user-1", name: "새 이름" });

    expect(db.update).toHaveBeenCalledWith(users);
    expect(set).toHaveBeenCalledWith({ name: "새 이름" });
    expect(where).toHaveBeenCalledWith(eq(users.id, "user-1"));
    expect(result?.name).toBe("새 이름");
  });

  it("updates the password and increments the session version atomically", async () => {
    const { set } = mockUpdateReturning({ ...mockUser, sessionVersion: 1 });

    const result = await updateUserPasswordAndIncrementSessionVersion({
      userId: "user-1",
      passwordHash: "new-hash",
    });

    expect(set).toHaveBeenCalledWith({
      passwordHash: "new-hash",
      sessionVersion: expect.anything(),
    });
    expect(result?.sessionVersion).toBe(1);
  });

  it("returns undefined when the target user no longer exists", async () => {
    mockUpdateReturning(undefined);

    await expect(
      updateUserName({ userId: "missing-user", name: "새 이름" }),
    ).resolves.toBeUndefined();
  });
});
