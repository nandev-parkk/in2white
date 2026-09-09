import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { db } from "@/db/client";
import { users, workspaceMemberships } from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";
import { memberParamsSchema } from "@/schemas/member.schema";
import { listMembers } from "@/services/member.service";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn() },
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";

async function createAccessToken(sub = "user-1") {
  return signAccessToken({
    sub,
    email: sub + "@example.com",
    sid: "session-1",
  });
}

beforeEach(() => {
  vi.mocked(db.select).mockReset();
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

describe("memberParamsSchema", () => {
  it("워크스페이스 UUID를 검증한다", () => {
    expect(memberParamsSchema.parse({ workspaceId })).toEqual({ workspaceId });
    expect(() => memberParamsSchema.parse({ workspaceId: "not-a-uuid" })).toThrow();
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

    const response = await request(createApp())
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

    const response = await request(createApp())
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

    const response = await request(createApp())
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
    const response = await request(createApp()).get(`/workspaces/${workspaceId}/members`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("유효하지 않은 Access Token이면 401이며 DB를 조회하지 않는다", async () => {
    const response = await request(createApp())
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
      const response = await request(createApp())
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

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken("outsider")}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("DB 오류를 공통 500 응답으로 변환한다", async () => {
    mockMemberListQueries({ memberError: new Error("members failed") });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
