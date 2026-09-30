import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { users, workspaceMemberships, workspaces } from "@/db/schema";
import { createUser, listUsers } from "@/services/admin-user.service";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));

const userId = "550e8400-e29b-41d4-a716-446655440001";
const workspaceId = "550e8400-e29b-41d4-a716-446655440002";
const createdAt = new Date("2026-09-20T00:00:00.000Z");

beforeEach(() => {
  vi.mocked(db.select).mockReset();
});

function mockListQueries({
  countRows = [{ total: 1 }],
  userRows = [] as unknown[],
  countError,
  userError,
}: {
  countRows?: unknown[];
  userRows?: unknown[];
  countError?: Error;
  userError?: Error;
} = {}) {
  const countQuery = {
    from: vi.fn().mockReturnThis(),
    where: countError
      ? vi.fn().mockRejectedValue(countError)
      : vi.fn().mockResolvedValue(countRows),
  };
  const userQuery = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: userError ? vi.fn().mockRejectedValue(userError) : vi.fn().mockResolvedValue(userRows),
  };

  vi.mocked(db.select)
    .mockReturnValueOnce(countQuery as never)
    .mockReturnValueOnce(userQuery as never);

  return { countQuery, userQuery };
}

function mockCreateUserTransaction({
  existingRows = [] as unknown[],
  userRows = [
    {
      id: userId,
      name: "새 사용자",
      email: "new.user@example.com",
      deactivatedAt: null,
      createdAt,
    },
  ] as unknown[],
  workspaceRows = [{ id: workspaceId }] as unknown[],
}: {
  existingRows?: unknown[];
  userRows?: unknown[];
  workspaceRows?: unknown[];
} = {}) {
  const existingQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(existingRows),
  };
  const userInsert = {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(userRows),
  };
  const workspaceInsert = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(workspaceRows),
  };
  const membershipInsert = {
    values: vi.fn().mockResolvedValue(undefined),
  };
  const tx = {
    select: vi.fn().mockReturnValue(existingQuery),
    insert: vi
      .fn()
      .mockReturnValueOnce(userInsert)
      .mockReturnValueOnce(workspaceInsert)
      .mockReturnValueOnce(membershipInsert),
  };

  return { tx, existingQuery, userInsert, workspaceInsert, membershipInsert };
}

describe("listUsers", () => {
  it("소속 워크스페이스 수와 페이지 정보를 함께 반환한다", async () => {
    mockListQueries({
      countRows: [{ total: 5 }],
      userRows: [
        {
          id: userId,
          name: "Kim User",
          email: "user@example.com",
          deactivatedAt: null,
          createdAt,
          workspaceCount: "3",
        },
      ],
    });

    await expect(listUsers({ status: "all", page: 2, limit: 2 })).resolves.toEqual({
      users: [
        {
          id: userId,
          name: "Kim User",
          email: "user@example.com",
          deactivatedAt: null,
          createdAt,
          workspaceCount: 3,
        },
      ],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
  });

  it("이름과 이메일 검색 조건을 두 질의에 같게 적용하고 와일드카드를 escape한다", async () => {
    const { countQuery, userQuery } = mockListQueries({ countRows: [{ total: 0 }] });

    await listUsers({ search: "100%_kim", status: "all", page: 1, limit: 20 });

    const expected = and(
      or(ilike(users.name, "%100\\%\\_kim%"), ilike(users.email, "%100\\%\\_kim%")),
      undefined,
    );
    expect(countQuery.where).toHaveBeenCalledWith(expected);
    expect(userQuery.where).toHaveBeenCalledWith(expected);
  });

  it.each([
    { status: "active" as const, condition: isNull(users.deactivatedAt) },
    { status: "deactivated" as const, condition: isNotNull(users.deactivatedAt) },
  ])("정지 여부 필터 $status를 조건으로 변환한다", async ({ status, condition }) => {
    const { countQuery, userQuery } = mockListQueries({ countRows: [{ total: 0 }] });

    await listUsers({ status, page: 1, limit: 20 });

    const expected = and(undefined, condition);
    expect(countQuery.where).toHaveBeenCalledWith(expected);
    expect(userQuery.where).toHaveBeenCalledWith(expected);
  });

  it("사용자당 한 행이 되도록 묶고 최신 생성 순으로 정렬한다", async () => {
    const { userQuery } = mockListQueries({ countRows: [{ total: 0 }] });

    await listUsers({ status: "all", page: 3, limit: 10 });

    expect(db.select).toHaveBeenNthCalledWith(1, { total: count() });
    expect(userQuery.from).toHaveBeenCalledWith(users);
    expect(userQuery.leftJoin).toHaveBeenCalledWith(
      workspaceMemberships,
      eq(workspaceMemberships.userId, users.id),
    );
    expect(userQuery.groupBy).toHaveBeenCalledWith(users.id);
    expect(userQuery.orderBy).toHaveBeenCalledWith(desc(users.createdAt), asc(users.id));
    expect(userQuery.limit).toHaveBeenCalledWith(10);
    expect(userQuery.offset).toHaveBeenCalledWith(20);
  });

  it.each([
    { label: "개수", options: { countError: new Error("count failed") }, message: "count failed" },
    { label: "목록", options: { userError: new Error("list failed") }, message: "list failed" },
  ])("$label DB 오류를 전파한다", async ({ options, message }) => {
    mockListQueries(options);

    await expect(listUsers({ status: "all", page: 1, limit: 20 })).rejects.toThrow(message);
  });
});

describe("createUser", () => {
  const input = {
    email: "  New.User@Example.com ",
    name: "새 사용자",
    passwordHash: "hashed-password",
  };

  it("이메일을 정규화해 저장하고 비밀번호가 없는 요약을 반환한다", async () => {
    const { tx, userInsert } = mockCreateUserTransaction();

    await expect(createUser(tx as never, input)).resolves.toEqual({
      id: userId,
      name: "새 사용자",
      email: "new.user@example.com",
      deactivatedAt: null,
      createdAt,
    });

    expect(tx.insert).toHaveBeenNthCalledWith(1, users);
    expect(userInsert.values).toHaveBeenCalledWith({
      email: "new.user@example.com",
      name: "새 사용자",
      passwordHash: "hashed-password",
    });
  });

  /* 제품 가입과 같은 불변식이다 — 기본 워크스페이스가 없으면 제품 화면이 빈 상태로 붕괴한다. */
  it("기본 워크스페이스와 Owner 멤버십을 같은 트랜잭션에서 만든다", async () => {
    const { tx, workspaceInsert, membershipInsert } = mockCreateUserTransaction();

    await createUser(tx as never, input);

    expect(tx.insert).toHaveBeenNthCalledWith(2, workspaces);
    expect(workspaceInsert.values).toHaveBeenCalledWith({
      name: "My Workspace",
      ownerId: userId,
      isDefault: true,
    });
    expect(tx.insert).toHaveBeenNthCalledWith(3, workspaceMemberships);
    expect(membershipInsert.values).toHaveBeenCalledWith({
      workspaceId,
      userId,
      role: "owner",
    });
  });

  it("대소문자만 다른 이메일도 중복으로 보고 insert하지 않는다", async () => {
    const { tx, existingQuery, userInsert } = mockCreateUserTransaction({
      existingRows: [{ id: userId }],
    });

    await expect(createUser(tx as never, input)).rejects.toMatchObject({
      status: 409,
      code: "EMAIL_ALREADY_EXISTS",
      message: "이미 사용 중인 이메일입니다",
    });

    expect(existingQuery.where).toHaveBeenCalledWith(
      sql`lower(${users.email}) = ${"new.user@example.com"}`,
    );
    expect(userInsert.values).not.toHaveBeenCalled();
  });

  /* 사전 조회와 insert 사이에 같은 이메일이 들어온 경합. unique 제약이 막아준 결과도 중복이다. */
  it("동시 요청으로 insert가 비면 409로 변환한다", async () => {
    const { tx } = mockCreateUserTransaction({ userRows: [] });

    await expect(createUser(tx as never, input)).rejects.toMatchObject({
      status: 409,
      code: "EMAIL_ALREADY_EXISTS",
    });
  });

  it("기본 워크스페이스 insert가 비면 오류를 던진다", async () => {
    const { tx, membershipInsert } = mockCreateUserTransaction({ workspaceRows: [] });

    await expect(createUser(tx as never, input)).rejects.toThrow(
      "Default workspace insert returned no row",
    );
    expect(membershipInsert.values).not.toHaveBeenCalled();
  });
});
