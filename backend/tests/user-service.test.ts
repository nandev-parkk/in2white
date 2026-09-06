import { describe, expect, it, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
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

  it("normalizes email to lowercase before querying", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);

    const result = await getUserByEmail("User@Example.com");

    expect(result?.id).toBe("user-1");
    expect(eq).toHaveBeenCalledWith(users.email, "user@example.com");
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
