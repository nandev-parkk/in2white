import { describe, expect, it, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getUserByEmail, getUserById } from "@/services/user.service";

vi.mock("@/db/client", () => ({
  db: {
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
