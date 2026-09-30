import { and, asc, count, desc, eq, ilike, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  projects,
  users,
  whiteboardDocuments,
  workspaceMemberships,
  workspaces,
} from "@/db/schema";
import {
  createUser,
  deactivateUser,
  getUserDetail,
  listUsers,
  reactivateUser,
  resetUserPassword,
  revokeUserSessions,
  updateUser,
} from "@/services/admin-user.service";

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

function mockUserDetailQueries({
  userRows = [
    { id: userId, name: "Kim User", email: "user@example.com", deactivatedAt: null, createdAt },
  ] as unknown[],
  workspaceRows = [] as unknown[],
  projectCountRows = [{ total: 3 }] as unknown[],
  documentCountRows = [{ total: 7 }] as unknown[],
} = {}) {
  const userQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(userRows),
  };
  const workspaceQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(workspaceRows),
  };
  const projectCountQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(projectCountRows),
  };
  const documentCountQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(documentCountRows),
  };

  vi.mocked(db.select)
    .mockReturnValueOnce(userQuery as never)
    .mockReturnValueOnce(workspaceQuery as never)
    .mockReturnValueOnce(projectCountQuery as never)
    .mockReturnValueOnce(documentCountQuery as never);

  return { userQuery, workspaceQuery, projectCountQuery, documentCountQuery };
}

function mockUpdateUserTransaction({
  existingRows = [
    { id: userId, name: "Kim User", email: "user@example.com", deactivatedAt: null, createdAt },
  ] as unknown[],
  duplicateRows = [] as unknown[],
  updatedRows = [
    { id: userId, name: "바뀐 이름", email: "changed@example.com", deactivatedAt: null, createdAt },
  ] as unknown[],
} = {}) {
  const existingQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(existingRows),
  };
  const duplicateQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(duplicateRows),
  };
  const userUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(updatedRows),
  };
  const tx = {
    select: vi.fn().mockReturnValueOnce(existingQuery).mockReturnValueOnce(duplicateQuery),
    update: vi.fn().mockReturnValue(userUpdate),
  };

  return { tx, existingQuery, duplicateQuery, userUpdate };
}

describe("getUserDetail", () => {
  it("소속 워크스페이스와 생성 리소스 수를 함께 반환한다", async () => {
    const joinedAt = new Date("2026-09-21T00:00:00.000Z");
    mockUserDetailQueries({
      workspaceRows: [
        { id: workspaceId, name: "My Workspace", isDefault: true, role: "owner", joinedAt },
      ],
      projectCountRows: [{ total: "3" }],
      documentCountRows: [{ total: "7" }],
    });

    await expect(getUserDetail(userId)).resolves.toEqual({
      user: {
        id: userId,
        name: "Kim User",
        email: "user@example.com",
        deactivatedAt: null,
        createdAt,
      },
      workspaces: [
        { id: workspaceId, name: "My Workspace", isDefault: true, role: "owner", joinedAt },
      ],
      createdProjectCount: 3,
      createdWhiteboardDocumentCount: 7,
    });
  });

  /* 소프트 삭제된 리소스는 제품에서 이미 보이지 않는다. 하드 삭제 영향 범위는 별도 엔드포인트가 센다. */
  it("생성 리소스는 삭제되지 않은 것만 센다", async () => {
    const { projectCountQuery, documentCountQuery, workspaceQuery } = mockUserDetailQueries();

    await getUserDetail(userId);

    expect(projectCountQuery.from).toHaveBeenCalledWith(projects);
    expect(projectCountQuery.where).toHaveBeenCalledWith(
      and(eq(projects.creatorId, userId), isNull(projects.deletedAt)),
    );
    expect(documentCountQuery.from).toHaveBeenCalledWith(whiteboardDocuments);
    expect(documentCountQuery.where).toHaveBeenCalledWith(
      and(eq(whiteboardDocuments.creatorId, userId), isNull(whiteboardDocuments.deletedAt)),
    );
    expect(workspaceQuery.innerJoin).toHaveBeenCalledWith(
      workspaces,
      eq(workspaceMemberships.workspaceId, workspaces.id),
    );
    expect(workspaceQuery.where).toHaveBeenCalledWith(eq(workspaceMemberships.userId, userId));
    expect(workspaceQuery.orderBy).toHaveBeenCalledWith(
      desc(workspaces.isDefault),
      asc(workspaces.name),
      asc(workspaces.id),
    );
  });

  it("없는 사용자는 404이며 뒤따르는 집계를 시작하지 않는다", async () => {
    const { workspaceQuery, projectCountQuery } = mockUserDetailQueries({ userRows: [] });

    await expect(getUserDetail(userId)).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
      message: "사용자를 찾을 수 없습니다",
    });

    expect(workspaceQuery.where).not.toHaveBeenCalled();
    expect(projectCountQuery.where).not.toHaveBeenCalled();
  });
});

describe("updateUser", () => {
  it("이름만 바꿀 때는 이메일 중복 검사를 하지 않는다", async () => {
    const { tx, duplicateQuery, userUpdate } = mockUpdateUserTransaction({
      updatedRows: [
        {
          id: userId,
          name: "바뀐 이름",
          email: "user@example.com",
          deactivatedAt: null,
          createdAt,
        },
      ],
    });

    await expect(updateUser(tx as never, { userId, name: "바뀐 이름" })).resolves.toEqual({
      previousUser: {
        id: userId,
        name: "Kim User",
        email: "user@example.com",
        deactivatedAt: null,
        createdAt,
      },
      user: {
        id: userId,
        name: "바뀐 이름",
        email: "user@example.com",
        deactivatedAt: null,
        createdAt,
      },
    });

    expect(duplicateQuery.where).not.toHaveBeenCalled();
    expect(userUpdate.set).toHaveBeenCalledWith({ name: "바뀐 이름" });
    expect(userUpdate.where).toHaveBeenCalledWith(eq(users.id, userId));
  });

  it("이메일을 정규화해 저장한다", async () => {
    const { tx, userUpdate } = mockUpdateUserTransaction();

    await updateUser(tx as never, { userId, email: " Changed@Example.COM " });

    expect(userUpdate.set).toHaveBeenCalledWith({ email: "changed@example.com" });
  });

  /* 자기 자신의 이메일을 그대로 다시 저장하는 요청을 중복으로 막으면 이름만 바꾸는 흐름이 깨진다. */
  it("자신을 제외한 사용자와 이메일이 겹칠 때만 409로 막는다", async () => {
    const { tx, duplicateQuery, userUpdate } = mockUpdateUserTransaction({
      duplicateRows: [{ id: "550e8400-e29b-41d4-a716-446655440099" }],
    });

    await expect(
      updateUser(tx as never, { userId, email: "changed@example.com" }),
    ).rejects.toMatchObject({
      status: 409,
      code: "EMAIL_ALREADY_EXISTS",
    });

    expect(duplicateQuery.where).toHaveBeenCalledWith(
      and(sql`lower(${users.email}) = ${"changed@example.com"}`, ne(users.id, userId)),
    );
    expect(userUpdate.set).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404이며 update를 시작하지 않는다", async () => {
    const { tx, userUpdate } = mockUpdateUserTransaction({ existingRows: [] });

    await expect(updateUser(tx as never, { userId, name: "바뀐 이름" })).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
    });

    expect(userUpdate.set).not.toHaveBeenCalled();
  });

  it("update가 행을 돌려주지 않으면 404로 변환한다", async () => {
    const { tx } = mockUpdateUserTransaction({ updatedRows: [] });

    await expect(updateUser(tx as never, { userId, name: "바뀐 이름" })).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
    });
  });
});

function mockStateChangeTransaction({
  existingRows = [
    { id: userId, name: "Kim User", email: "user@example.com", deactivatedAt: null, createdAt },
  ] as unknown[],
  updatedRows = [
    { id: userId, name: "Kim User", email: "user@example.com", deactivatedAt: null, createdAt },
  ] as unknown[],
} = {}) {
  const existingQuery = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(existingRows),
  };
  const userUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(updatedRows),
  };
  const tx = {
    select: vi.fn().mockReturnValue(existingQuery),
    update: vi.fn().mockReturnValue(userUpdate),
  };

  return { tx, existingQuery, userUpdate };
}

const bumpSessionVersion = sql`${users.sessionVersion} + 1`;

describe("resetUserPassword", () => {
  it("해시를 저장하고 세션 버전을 올린다", async () => {
    const { tx, userUpdate } = mockStateChangeTransaction();

    await expect(
      resetUserPassword(tx as never, { userId, passwordHash: "new-hash" }),
    ).resolves.toMatchObject({ user: { id: userId } });

    expect(userUpdate.set).toHaveBeenCalledWith({
      passwordHash: "new-hash",
      sessionVersion: bumpSessionVersion,
    });
    expect(userUpdate.where).toHaveBeenCalledWith(eq(users.id, userId));
  });

  it("없는 사용자는 404이며 update를 시작하지 않는다", async () => {
    const { tx, userUpdate } = mockStateChangeTransaction({ existingRows: [] });

    await expect(
      resetUserPassword(tx as never, { userId, passwordHash: "new-hash" }),
    ).rejects.toMatchObject({ status: 404, code: "USER_NOT_FOUND" });

    expect(userUpdate.set).not.toHaveBeenCalled();
  });
});

describe("deactivateUser", () => {
  /*
   * 이미 정지된 계정을 다시 정지해도 처음 정지 시각을 유지한다. 시각이 밀리면
   * 감사 로그의 정지 시점과 사용자 레코드가 어긋난다.
   */
  it("정지 시각을 유지하면서 설정하고 세션 버전을 올린다", async () => {
    const deactivatedAt = new Date("2026-09-30T00:00:00.000Z");
    const { tx, userUpdate } = mockStateChangeTransaction({
      updatedRows: [
        { id: userId, name: "Kim User", email: "user@example.com", deactivatedAt, createdAt },
      ],
    });

    await expect(deactivateUser(tx as never, userId)).resolves.toEqual({
      previousUser: {
        id: userId,
        name: "Kim User",
        email: "user@example.com",
        deactivatedAt: null,
        createdAt,
      },
      user: { id: userId, name: "Kim User", email: "user@example.com", deactivatedAt, createdAt },
    });

    expect(userUpdate.set).toHaveBeenCalledWith({
      deactivatedAt: sql`coalesce(${users.deactivatedAt}, now())`,
      sessionVersion: bumpSessionVersion,
    });
  });

  it("없는 사용자는 404다", async () => {
    const { tx } = mockStateChangeTransaction({ existingRows: [] });

    await expect(deactivateUser(tx as never, userId)).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
    });
  });
});

describe("reactivateUser", () => {
  /* 정지 해제는 세션을 끊지 않는다 — 정지 시점에 이미 모든 세션이 무효화됐다. */
  it("정지 시각만 비우고 세션 버전은 건드리지 않는다", async () => {
    const { tx, userUpdate } = mockStateChangeTransaction({
      existingRows: [
        {
          id: userId,
          name: "Kim User",
          email: "user@example.com",
          deactivatedAt: new Date("2026-09-30T00:00:00.000Z"),
          createdAt,
        },
      ],
    });

    await expect(reactivateUser(tx as never, userId)).resolves.toMatchObject({
      user: { deactivatedAt: null },
    });

    expect(userUpdate.set).toHaveBeenCalledWith({ deactivatedAt: null });
  });

  it("없는 사용자는 404다", async () => {
    const { tx } = mockStateChangeTransaction({ existingRows: [] });

    await expect(reactivateUser(tx as never, userId)).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
    });
  });
});

describe("revokeUserSessions", () => {
  it("세션 버전만 올린다", async () => {
    const { tx, userUpdate } = mockStateChangeTransaction();

    await expect(revokeUserSessions(tx as never, userId)).resolves.toMatchObject({
      user: { id: userId },
    });

    expect(userUpdate.set).toHaveBeenCalledWith({ sessionVersion: bumpSessionVersion });
  });

  it("없는 사용자는 404다", async () => {
    const { tx } = mockStateChangeTransaction({ existingRows: [] });

    await expect(revokeUserSessions(tx as never, userId)).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
    });
  });
});
