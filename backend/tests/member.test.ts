import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { users, workspaceMemberships, workspaces } from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";
import {
  addMemberBodySchema,
  memberParamsSchema,
  memberRemoveParamsSchema,
} from "@/schemas/member.schema";
import { addMember, listMembers, removeMember } from "@/services/member.service";

const appUrl = useTestServer(() => createApp());

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const targetUserId = "550e8400-e29b-41d4-a716-446655440001";
const memberUserId = "550e8400-e29b-41d4-a716-446655440002";
const ownerUserId = "550e8400-e29b-41d4-a716-446655440003";

async function createAccessToken(sub = "user-1") {
  return signAccessToken({
    sub,
    email: sub + "@example.com",
    sid: "session-1",
    ver: 0,
  });
}

beforeEach(() => {
  vi.mocked(db.select).mockReset();
  vi.mocked(db.transaction).mockReset();
});

function mockMemberListQueries({
  membershipRows = [{ id: "membership-1" }],
  countRows = [{ total: 2 }],
  memberRows = [],
  membershipError,
  countError,
  memberError,
}: {
  membershipRows?: unknown[];
  countRows?: unknown[];
  memberRows?: unknown[];
  membershipError?: Error;
  countError?: Error;
  memberError?: Error;
} = {}) {
  const membershipQuery = {
    from: vi.fn().mockReturnThis(),
    where: membershipError
      ? vi.fn().mockRejectedValue(membershipError)
      : vi.fn().mockResolvedValue(membershipRows),
  };
  const countQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: countError
      ? vi.fn().mockRejectedValue(countError)
      : vi.fn().mockResolvedValue(countRows),
  };
  const memberQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: memberError
      ? vi.fn().mockRejectedValue(memberError)
      : vi.fn().mockResolvedValue(memberRows),
  };

  vi.mocked(db.select)
    .mockReturnValueOnce(membershipQuery as never)
    .mockReturnValueOnce(countQuery as never)
    .mockReturnValueOnce(memberQuery as never);

  return { membershipQuery, countQuery, memberQuery };
}

function mockAddMemberTransaction({
  requesterRows = [{ role: "owner" }],
  userRows = [{ id: targetUserId, name: "Kim Member", email: "member@example.com" }],
  existingRows = [],
  membershipRows = [
    {
      role: "member",
      joinedAt: new Date("2026-09-10T00:00:00.000Z"),
    },
  ],
  requesterError,
  userError,
  existingError,
  insertError,
}: {
  requesterRows?: unknown[];
  userRows?: unknown[];
  existingRows?: unknown[];
  membershipRows?: unknown[];
  requesterError?: Error;
  userError?: Error;
  existingError?: Error;
  insertError?: Error;
} = {}) {
  const requesterQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: requesterError
      ? vi.fn().mockRejectedValue(requesterError)
      : vi.fn().mockResolvedValue(requesterRows),
  };
  const userQuery = {
    from: vi.fn().mockReturnThis(),
    where: userError ? vi.fn().mockRejectedValue(userError) : vi.fn().mockResolvedValue(userRows),
  };
  const existingQuery = {
    from: vi.fn().mockReturnThis(),
    where: existingError
      ? vi.fn().mockRejectedValue(existingError)
      : vi.fn().mockResolvedValue(existingRows),
  };
  const membershipInsert = {
    values: vi.fn().mockReturnThis(),
    returning: insertError
      ? vi.fn().mockRejectedValue(insertError)
      : vi.fn().mockResolvedValue(membershipRows),
  };
  const transaction = {
    select: vi
      .fn()
      .mockReturnValueOnce(requesterQuery)
      .mockReturnValueOnce(userQuery)
      .mockReturnValueOnce(existingQuery),
    insert: vi.fn().mockReturnValue(membershipInsert),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { requesterQuery, userQuery, existingQuery, membershipInsert, transaction };
}

function mockRemoveMemberTransaction({
  requesterRows = [{ role: "owner" }],
  deletedRows = [{ id: "membership-2" }],
  requesterError,
  deleteError,
}: {
  requesterRows?: unknown[];
  deletedRows?: unknown[];
  requesterError?: Error;
  deleteError?: Error;
} = {}) {
  const requesterQuery = {
    from: vi.fn().mockReturnThis(),
    where: requesterError
      ? vi.fn().mockRejectedValue(requesterError)
      : vi.fn().mockResolvedValue(requesterRows),
  };
  const membershipDelete = {
    where: vi.fn().mockReturnThis(),
    returning: deleteError
      ? vi.fn().mockRejectedValue(deleteError)
      : vi.fn().mockResolvedValue(deletedRows),
  };
  const transaction = {
    select: vi.fn().mockReturnValue(requesterQuery),
    delete: vi.fn().mockReturnValue(membershipDelete),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { requesterQuery, membershipDelete, transaction };
}

describe("memberParamsSchema", () => {
  it("워크스페이스 UUID를 검증한다", () => {
    expect(memberParamsSchema.parse({ workspaceId })).toEqual({ workspaceId });
    expect(() => memberParamsSchema.parse({ workspaceId: "not-a-uuid" })).toThrow();
  });
});

describe("memberRemoveParamsSchema", () => {
  it("workspaceId와 userId UUID를 허용한다", () => {
    expect(memberRemoveParamsSchema.parse({ workspaceId, userId: targetUserId })).toEqual({
      workspaceId,
      userId: targetUserId,
    });
  });

  it.each([
    { workspaceId: "not-a-uuid", userId: targetUserId },
    { workspaceId, userId: "not-a-uuid" },
  ])("UUID가 아닌 path parameter를 거부한다", (params) => {
    expect(() => memberRemoveParamsSchema.parse(params)).toThrow();
  });
});

describe("addMemberBodySchema", () => {
  const targetUserId = "550e8400-e29b-41d4-a716-446655440001";

  it("userId UUID를 허용한다", () => {
    expect(addMemberBodySchema.parse({ userId: targetUserId })).toEqual({
      userId: targetUserId,
    });
  });

  it("userId가 없거나 UUID가 아니면 거부한다", () => {
    expect(() => addMemberBodySchema.parse({})).toThrow();
    expect(() => addMemberBodySchema.parse({ userId: "not-a-uuid" })).toThrow();
  });

  it("userId 외의 body 필드를 거부한다", () => {
    expect(() => addMemberBodySchema.parse({ userId: targetUserId, role: "owner" })).toThrow();
  });
});

describe("addMember", () => {
  it("Owner가 존재하는 사용자를 멤버로 추가한다", async () => {
    const joinedAt = new Date("2026-09-10T00:00:00.000Z");
    const { requesterQuery, userQuery, existingQuery, membershipInsert, transaction } =
      mockAddMemberTransaction({ membershipRows: [{ role: "member", joinedAt }] });

    await expect(
      addMember({
        workspaceId,
        requesterId: "owner-1",
        userId: targetUserId,
      }),
    ).resolves.toEqual({
      userId: targetUserId,
      name: "Kim Member",
      email: "member@example.com",
      role: "member",
      joinedAt,
    });

    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transaction.select).toHaveBeenNthCalledWith(1, {
      role: workspaceMemberships.role,
      isDefault: workspaces.isDefault,
    });
    expect(transaction.select).toHaveBeenNthCalledWith(2, {
      id: users.id,
      name: users.name,
      email: users.email,
    });
    expect(transaction.select).toHaveBeenNthCalledWith(3, { id: workspaceMemberships.id });
    expect(requesterQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(requesterQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "owner-1"),
      ),
    );
    expect(userQuery.from).toHaveBeenCalledWith(users);
    expect(userQuery.where).toHaveBeenCalledWith(eq(users.id, targetUserId));
    expect(existingQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(existingQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, targetUserId),
      ),
    );
    expect(membershipInsert.values).toHaveBeenCalledWith({
      workspaceId,
      userId: targetUserId,
      role: "member",
    });
  });

  it("비멤버는 워크스페이스를 찾을 수 없음으로 거부하고 대상 조회를 시작하지 않는다", async () => {
    const { transaction, userQuery, membershipInsert } = mockAddMemberTransaction({
      requesterRows: [],
    });

    await expect(
      addMember({ workspaceId, requesterId: "outsider", userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
      message: "워크스페이스를 찾을 수 없습니다",
    });

    expect(transaction.select).toHaveBeenCalledOnce();
    expect(userQuery.where).not.toHaveBeenCalled();
    expect(membershipInsert.values).not.toHaveBeenCalled();
  });

  it("일반 Member는 멤버를 추가할 수 없다", async () => {
    const { transaction, userQuery, membershipInsert } = mockAddMemberTransaction({
      requesterRows: [{ role: "member" }],
    });

    await expect(
      addMember({ workspaceId, requesterId: "member-1", userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 403,
      code: "MEMBER_ADD_FORBIDDEN",
      message: "멤버를 추가할 권한이 없습니다",
    });

    expect(transaction.select).toHaveBeenCalledOnce();
    expect(userQuery.where).not.toHaveBeenCalled();
    expect(membershipInsert.values).not.toHaveBeenCalled();
  });

  it("기본 워크스페이스에는 멤버를 추가할 수 없다", async () => {
    const { transaction, requesterQuery, userQuery, membershipInsert } = mockAddMemberTransaction({
      requesterRows: [{ role: "owner", isDefault: true }],
    });

    await expect(
      addMember({ workspaceId, requesterId: ownerUserId, userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 403,
      code: "MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN",
      message: "기본 워크스페이스에는 멤버를 추가할 수 없습니다",
    });

    expect(transaction.select).toHaveBeenCalledOnce();
    expect(requesterQuery.innerJoin).toHaveBeenCalledWith(
      workspaces,
      eq(workspaceMemberships.workspaceId, workspaces.id),
    );
    expect(userQuery.where).not.toHaveBeenCalled();
    expect(membershipInsert.values).not.toHaveBeenCalled();
  });

  it("존재하지 않는 대상 사용자는 추가할 수 없다", async () => {
    const { transaction, existingQuery, membershipInsert } = mockAddMemberTransaction({
      userRows: [],
    });

    await expect(
      addMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
      message: "사용자를 찾을 수 없습니다",
    });

    expect(transaction.select).toHaveBeenCalledTimes(2);
    expect(existingQuery.where).not.toHaveBeenCalled();
    expect(membershipInsert.values).not.toHaveBeenCalled();
  });

  it("이미 멤버인 사용자는 중복으로 거부한다", async () => {
    const { membershipInsert } = mockAddMemberTransaction({
      existingRows: [{ id: "membership-1" }],
    });

    await expect(
      addMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 409,
      code: "MEMBER_ALREADY_EXISTS",
      message: "이미 워크스페이스 멤버입니다",
    });

    expect(membershipInsert.values).not.toHaveBeenCalled();
  });

  it("멤버십 unique 오류를 중복 오류로 변환한다", async () => {
    const uniqueError = Object.assign(new Error("duplicate membership"), { code: "23505" });
    mockAddMemberTransaction({ insertError: uniqueError });

    await expect(
      addMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 409,
      code: "MEMBER_ALREADY_EXISTS",
      message: "이미 워크스페이스 멤버입니다",
    });
  });

  it.each([
    {
      label: "요청자 멤버십",
      options: { requesterError: new Error("requester membership failed") },
      expectedMessage: "requester membership failed",
    },
    {
      label: "대상 사용자",
      options: { userError: new Error("target user failed") },
      expectedMessage: "target user failed",
    },
    {
      label: "기존 멤버십",
      options: { existingError: new Error("existing membership failed") },
      expectedMessage: "existing membership failed",
    },
    {
      label: "멤버십 insert",
      options: { insertError: new Error("membership insert failed") },
      expectedMessage: "membership insert failed",
    },
  ])("$label DB 오류를 전파한다", async ({ options, expectedMessage }) => {
    mockAddMemberTransaction(options);

    await expect(
      addMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
    ).rejects.toThrow(expectedMessage);
  });
});

describe("removeMember", () => {
  it("Owner가 다른 멤버를 내보낸다", async () => {
    const { membershipDelete, transaction } = mockRemoveMemberTransaction();

    await expect(
      removeMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
    ).resolves.toBeUndefined();

    expect(transaction.delete).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipDelete.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, targetUserId),
      ),
    );
  });

  it("Member가 자기 자신을 탈퇴한다", async () => {
    const { membershipDelete, transaction } = mockRemoveMemberTransaction({
      requesterRows: [{ role: "member" }],
    });

    await expect(
      removeMember({ workspaceId, requesterId: "member-1", userId: "member-1" }),
    ).resolves.toBeUndefined();

    expect(transaction.delete).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipDelete.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "member-1"),
      ),
    );
  });

  it("비멤버 요청자는 워크스페이스 없음으로 거부하고 삭제하지 않는다", async () => {
    const { membershipDelete } = mockRemoveMemberTransaction({ requesterRows: [] });

    await expect(
      removeMember({ workspaceId, requesterId: "outsider", userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
    });

    expect(membershipDelete.where).not.toHaveBeenCalled();
  });

  it("Member가 다른 멤버를 내보낼 수 없다", async () => {
    const { membershipDelete } = mockRemoveMemberTransaction({
      requesterRows: [{ role: "member" }],
    });

    await expect(
      removeMember({ workspaceId, requesterId: "member-1", userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 403,
      code: "MEMBER_REMOVE_FORBIDDEN",
    });

    expect(membershipDelete.where).not.toHaveBeenCalled();
  });

  it("Owner가 자기 자신을 내보낼 수 없다", async () => {
    const { membershipDelete } = mockRemoveMemberTransaction();

    await expect(
      removeMember({ workspaceId, requesterId: "owner-1", userId: "owner-1" }),
    ).rejects.toMatchObject({
      status: 403,
      code: "MEMBER_SELF_REMOVE_FORBIDDEN",
    });

    expect(membershipDelete.where).not.toHaveBeenCalled();
  });

  it("대소문자만 다른 유효 UUID의 Owner 자기 탈퇴를 차단한다", async () => {
    const uppercaseOwnerId = workspaceId.toUpperCase();
    const { requesterQuery, membershipDelete } = mockRemoveMemberTransaction();

    await expect(
      removeMember({ workspaceId, requesterId: uppercaseOwnerId, userId: workspaceId }),
    ).rejects.toMatchObject({
      status: 403,
      code: "MEMBER_SELF_REMOVE_FORBIDDEN",
    });

    expect(requesterQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, workspaceId),
      ),
    );
    expect(membershipDelete.where).not.toHaveBeenCalled();
  });

  it("대상 멤버십이 없으면 MEMBER_NOT_FOUND를 반환한다", async () => {
    mockRemoveMemberTransaction({ deletedRows: [] });

    await expect(
      removeMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
    ).rejects.toMatchObject({
      status: 404,
      code: "MEMBER_NOT_FOUND",
    });
  });

  it.each([
    {
      label: "요청자 멤버십",
      options: { requesterError: new Error("requester membership removal failed") },
      expectedMessage: "requester membership removal failed",
    },
    {
      label: "멤버십 삭제",
      options: { deleteError: new Error("membership deletion failed") },
      expectedMessage: "membership deletion failed",
    },
  ])("$label DB 오류를 전파한다", async ({ options, expectedMessage }) => {
    mockRemoveMemberTransaction(options);

    await expect(
      removeMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
    ).rejects.toThrow(expectedMessage);
  });
});

describe("listMembers", () => {
  it("이름 또는 이메일 검색 조건으로 멤버와 페이지 정보를 반환한다", async () => {
    const joinedAt = new Date("2026-09-10T00:00:00.000Z");
    const { membershipQuery, countQuery, memberQuery } = mockMemberListQueries({
      countRows: [{ total: 5 }],
      memberRows: [
        {
          userId: "user-owner",
          name: "Kim Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt,
        },
      ],
    });

    await expect(
      listMembers({
        workspaceId,
        requesterId: "user-1",
        search: "Kim",
        page: 2,
        limit: 2,
      }),
    ).resolves.toEqual({
      members: [
        {
          userId: "user-owner",
          name: "Kim Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt,
        },
      ],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });

    expect(db.select).toHaveBeenNthCalledWith(1, { id: workspaceMemberships.id });
    expect(db.select).toHaveBeenNthCalledWith(2, { total: count() });
    expect(db.select).toHaveBeenNthCalledWith(3, {
      userId: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMemberships.role,
      joinedAt: workspaceMemberships.createdAt,
    });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );

    const searchCondition = and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      or(ilike(users.name, "%Kim%"), ilike(users.email, "%Kim%")),
    );
    expect(countQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(countQuery.innerJoin).toHaveBeenCalledWith(
      users,
      eq(workspaceMemberships.userId, users.id),
    );
    expect(countQuery.where).toHaveBeenCalledWith(searchCondition);
    expect(memberQuery.where).toHaveBeenCalledWith(searchCondition);
    expect(memberQuery.orderBy).toHaveBeenCalledWith(
      sql<number>`case when ${workspaceMemberships.role} = 'owner' then 0 else 1 end`,
      asc(workspaceMemberships.createdAt),
      asc(users.id),
    );
    expect(memberQuery.limit).toHaveBeenCalledWith(2);
    expect(memberQuery.offset).toHaveBeenCalledWith(2);
  });

  it("LIKE 와일드카드와 백슬래시를 이름과 이메일 검색에서 escape한다", async () => {
    const { countQuery, memberQuery } = mockMemberListQueries({
      countRows: [{ total: 0 }],
      memberRows: [],
    });

    await listMembers({
      workspaceId,
      requesterId: "user-1",
      search: "100%_done\\now",
      page: 1,
      limit: 20,
    });

    const escapedCondition = and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      or(ilike(users.name, "%100\\%\\_done\\\\now%"), ilike(users.email, "%100\\%\\_done\\\\now%")),
    );
    expect(countQuery.where).toHaveBeenCalledWith(escapedCondition);
    expect(memberQuery.where).toHaveBeenCalledWith(escapedCondition);
  });

  it("검색 결과가 없거나 page가 범위를 초과하면 빈 목록과 실제 pagination을 반환한다", async () => {
    mockMemberListQueries({ countRows: [{ total: 5 }], memberRows: [] });

    await expect(
      listMembers({
        workspaceId,
        requesterId: "user-1",
        page: 4,
        limit: 2,
      }),
    ).resolves.toEqual({
      members: [],
      pagination: { page: 4, limit: 2, total: 5, totalPages: 3 },
    });
  });

  it("비멤버는 404이며 count와 목록 조회를 시작하지 않는다", async () => {
    const { countQuery, memberQuery } = mockMemberListQueries({ membershipRows: [] });

    await expect(
      listMembers({ workspaceId, requesterId: "outsider", page: 1, limit: 20 }),
    ).rejects.toMatchObject({
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
      message: "워크스페이스를 찾을 수 없습니다",
    });
    expect(db.select).toHaveBeenCalledOnce();
    expect(countQuery.where).not.toHaveBeenCalled();
    expect(memberQuery.where).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "멤버십",
      options: { membershipError: new Error("membership failed") },
      expectedMessage: "membership failed",
    },
    {
      label: "개수",
      options: { countError: new Error("count failed") },
      expectedMessage: "count failed",
    },
    {
      label: "목록",
      options: { memberError: new Error("members failed") },
      expectedMessage: "members failed",
    },
  ])("$label DB 오류를 전파한다", async ({ options, expectedMessage }) => {
    mockMemberListQueries(options);

    await expect(
      listMembers({ workspaceId, requesterId: "user-1", page: 1, limit: 20 }),
    ).rejects.toThrow(expectedMessage);
  });
});

describe("GET /workspaces/:workspaceId/members", () => {
  it("인증된 Member에게 직렬화된 멤버 목록을 반환한다", async () => {
    const joinedAt = new Date("2026-09-10T00:00:00.000Z");
    mockMemberListQueries({
      membershipRows: [{ id: "requester-membership", role: "member" }],
      countRows: [{ total: 2 }],
      memberRows: [
        {
          userId: "owner-1",
          name: "Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt,
        },
        {
          userId: "user-1",
          name: "Member",
          email: "member@example.com",
          role: "member",
          joinedAt,
        },
      ],
    });

    const response = await request(appUrl())
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      members: [
        {
          userId: "owner-1",
          name: "Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt: joinedAt.toISOString(),
        },
        {
          userId: "user-1",
          name: "Member",
          email: "member@example.com",
          role: "member",
          joinedAt: joinedAt.toISOString(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });

  it("Owner에게도 멤버 목록을 반환한다", async () => {
    const { membershipQuery } = mockMemberListQueries({
      membershipRows: [{ id: "owner-membership", role: "owner" }],
      countRows: [{ total: 0 }],
      memberRows: [],
    });

    const response = await request(appUrl())
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("owner-1")}`);

    expect(response.status).toBe(200);
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "owner-1"),
      ),
    );
  });

  it("검색어를 trim하고 명시한 page와 limit를 적용한다", async () => {
    const { countQuery, memberQuery } = mockMemberListQueries({
      countRows: [{ total: 5 }],
      memberRows: [],
    });

    const response = await request(appUrl())
      .get(`/workspaces/${workspaceId}/members`)
      .query({ search: "  Kim  ", page: "2", limit: "2" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    const searchCondition = and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      or(ilike(users.name, "%Kim%"), ilike(users.email, "%Kim%")),
    );
    expect(countQuery.where).toHaveBeenCalledWith(searchCondition);
    expect(memberQuery.where).toHaveBeenCalledWith(searchCondition);
    expect(memberQuery.limit).toHaveBeenCalledWith(2);
    expect(memberQuery.offset).toHaveBeenCalledWith(2);
  });

  it("인증이 없으면 401이며 DB를 조회하지 않는다", async () => {
    const response = await request(appUrl()).get(`/workspaces/${workspaceId}/members`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("유효하지 않은 Access Token이면 401이며 DB를 조회하지 않는다", async () => {
    const response = await request(appUrl())
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.select).not.toHaveBeenCalled();
  });

  it.each([
    { pathWorkspaceId: "not-a-uuid", query: {} },
    { pathWorkspaceId: workspaceId, query: { page: "0" } },
    { pathWorkspaceId: workspaceId, query: { limit: "101" } },
    { pathWorkspaceId: workspaceId, query: { search: "a".repeat(101) } },
  ])(
    "잘못된 path 또는 query는 400이며 DB를 조회하지 않는다",
    async ({ pathWorkspaceId, query }) => {
      const response = await request(appUrl())
        .get(`/workspaces/${pathWorkspaceId}/members`)
        .query(query)
        .set("Authorization", `Bearer ${await createAccessToken()}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(db.select).not.toHaveBeenCalled();
    },
  );

  it("비멤버에게 404를 반환한다", async () => {
    mockMemberListQueries({ membershipRows: [] });

    const response = await request(appUrl())
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("outsider")}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("DB 오류를 공통 500 응답으로 변환한다", async () => {
    mockMemberListQueries({ memberError: new Error("members failed") });

    const response = await request(appUrl())
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("POST /workspaces/:workspaceId/members", () => {
  it("Owner가 사용자를 멤버로 추가하고 생성된 멤버를 반환한다", async () => {
    const joinedAt = new Date("2026-09-10T00:00:00.000Z");
    mockAddMemberTransaction({
      membershipRows: [{ role: "member", joinedAt }],
    });

    const response = await request(appUrl())
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("owner-1")}`)
      .send({ userId: targetUserId });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      member: {
        userId: targetUserId,
        name: "Kim Member",
        email: "member@example.com",
        role: "member",
        joinedAt: joinedAt.toISOString(),
      },
    });
  });

  it("인증되지 않은 요청은 401이며 transaction을 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .post(`/workspaces/${workspaceId}/members`)
      .send({ userId: targetUserId });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { pathWorkspaceId: "not-a-uuid", body: { userId: targetUserId } },
    { pathWorkspaceId: workspaceId, body: {} },
    { pathWorkspaceId: workspaceId, body: { userId: "not-a-uuid" } },
    { pathWorkspaceId: workspaceId, body: { userId: targetUserId, role: "owner" } },
  ])(
    "잘못된 path 또는 body는 400이며 transaction을 호출하지 않는다",
    async ({ pathWorkspaceId, body }) => {
      const response = await request(appUrl())
        .post(`/workspaces/${pathWorkspaceId}/members`)
        .set("Authorization", `Bearer ${await createAccessToken("owner-1")}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it("비멤버 요청자는 404를 반환한다", async () => {
    mockAddMemberTransaction({ requesterRows: [] });

    const response = await request(appUrl())
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("outsider")}`)
      .send({ userId: targetUserId });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("일반 Member 요청자는 403을 반환한다", async () => {
    mockAddMemberTransaction({ requesterRows: [{ role: "member" }] });

    const response = await request(appUrl())
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("member-1")}`)
      .send({ userId: targetUserId });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MEMBER_ADD_FORBIDDEN");
  });

  it("존재하지 않는 대상 사용자는 404를 반환한다", async () => {
    mockAddMemberTransaction({ userRows: [] });

    const response = await request(appUrl())
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("owner-1")}`)
      .send({ userId: targetUserId });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("이미 멤버인 대상 사용자는 409를 반환한다", async () => {
    mockAddMemberTransaction({ existingRows: [{ id: "membership-1" }] });

    const response = await request(appUrl())
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("owner-1")}`)
      .send({ userId: targetUserId });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MEMBER_ALREADY_EXISTS");
  });

  it("예상하지 못한 DB 오류는 공통 500 응답으로 변환된다", async () => {
    mockAddMemberTransaction({ insertError: new Error("membership insert failed") });

    const response = await request(appUrl())
      .post(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("owner-1")}`)
      .send({ userId: targetUserId });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("DELETE /workspaces/:workspaceId/members/:userId", () => {
  it("Owner가 다른 멤버를 내보내고 204를 반환한다", async () => {
    const { membershipDelete } = mockRemoveMemberTransaction();

    const response = await request(appUrl())
      .delete("/workspaces/" + workspaceId + "/members/" + targetUserId)
      .set("Authorization", "Bearer " + (await createAccessToken("owner-1")));

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(membershipDelete.where).toHaveBeenCalledOnce();
  });

  it("Member가 자기 자신을 탈퇴하고 204를 반환한다", async () => {
    mockRemoveMemberTransaction({ requesterRows: [{ role: "member" }] });

    const response = await request(appUrl())
      .delete("/workspaces/" + workspaceId + "/members/" + memberUserId)
      .set("Authorization", "Bearer " + (await createAccessToken(memberUserId)));

    expect(response.status).toBe(204);
  });

  it("인증되지 않은 요청은 401을 반환한다", async () => {
    const response = await request(appUrl()).delete(
      "/workspaces/" + workspaceId + "/members/" + targetUserId,
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("Member의 타인 내보내기는 403을 반환한다", async () => {
    const { membershipDelete } = mockRemoveMemberTransaction({
      requesterRows: [{ role: "member" }],
    });

    const response = await request(appUrl())
      .delete("/workspaces/" + workspaceId + "/members/" + targetUserId)
      .set("Authorization", "Bearer " + (await createAccessToken("member-1")));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MEMBER_REMOVE_FORBIDDEN");
    expect(membershipDelete.where).not.toHaveBeenCalled();
  });

  it("Owner 자기 탈퇴는 403을 반환한다", async () => {
    const { membershipDelete } = mockRemoveMemberTransaction();

    const response = await request(appUrl())
      .delete("/workspaces/" + workspaceId + "/members/" + ownerUserId)
      .set("Authorization", "Bearer " + (await createAccessToken(ownerUserId)));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MEMBER_SELF_REMOVE_FORBIDDEN");
    expect(membershipDelete.where).not.toHaveBeenCalled();
  });

  it.each(["not-a-uuid/members/" + targetUserId, workspaceId + "/members/not-a-uuid"])(
    "잘못된 path parameter는 400이고 transaction을 호출하지 않는다",
    async (path) => {
      const response = await request(appUrl())
        .delete("/workspaces/" + path)
        .set("Authorization", "Bearer " + (await createAccessToken("owner-1")));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it("대상 멤버십이 없으면 404 MEMBER_NOT_FOUND를 반환한다", async () => {
    mockRemoveMemberTransaction({ deletedRows: [] });

    const response = await request(appUrl())
      .delete("/workspaces/" + workspaceId + "/members/" + targetUserId)
      .set("Authorization", "Bearer " + (await createAccessToken("owner-1")));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("MEMBER_NOT_FOUND");
  });

  it("DB 오류는 500 INTERNAL_SERVER_ERROR로 변환한다", async () => {
    mockRemoveMemberTransaction({ deleteError: new Error("membership delete failed") });

    const response = await request(appUrl())
      .delete("/workspaces/" + workspaceId + "/members/" + targetUserId)
      .set("Authorization", "Bearer " + (await createAccessToken("owner-1")));

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
