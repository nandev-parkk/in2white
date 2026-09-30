import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { users, workspaceMemberships, workspaces } from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";
import { listMemberCandidates } from "@/services/member.service";

const appUrl = useTestServer(() => createApp());

vi.mock("@/db/client", () => ({ db: { select: vi.fn() } }));
const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const requesterId = "550e8400-e29b-41d4-a716-446655440001";
const input = { workspaceId, requesterId, page: 1, limit: 20 };
const candidates = [
  { id: requesterId, name: "김멤버", email: "member@example.com", isMember: true },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    name: "새사용자",
    email: "new@example.com",
    isMember: false,
  },
];
beforeEach(() => vi.mocked(db.select).mockReset());
function mockQueries({
  role = "owner",
  isDefault = false,
  total = 2,
  rows = candidates,
  error,
}: {
  role?: string | null;
  isDefault?: boolean;
  total?: number;
  rows?: typeof candidates;
  error?: Error;
} = {}) {
  const membership = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(role ? [{ role, isDefault }] : []),
  };
  const count = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue([{ total }]) };
  const list = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: error ? vi.fn().mockRejectedValue(error) : vi.fn().mockResolvedValue(rows),
  };
  vi.mocked(db.select)
    .mockReturnValueOnce(membership as never)
    .mockReturnValueOnce(count as never)
    .mockReturnValueOnce(list as never);
  return { membership, count, list };
}
async function get(query = {}, id = workspaceId) {
  const token = await signAccessToken({
    sub: requesterId,
    email: "owner@example.com",
    sid: "session-1",
    ver: 0,
  });
  return request(appUrl())
    .get(`/workspaces/${id}/member-candidates`)
    .query(query)
    .set("Authorization", `Bearer ${token}`);
}

describe("listMemberCandidates", () => {
  it.each([
    [null, false, 404, "WORKSPACE_NOT_FOUND"],
    ["member", false, 403, "MEMBER_SEARCH_FORBIDDEN"],
    ["owner", true, 403, "MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN"],
  ] as const)(
    "권한 %s·기본 워크스페이스 %s는 사용자 조회 전에 차단한다",
    async (role, isDefault, status, code) => {
      const { membership } = mockQueries({ role, isDefault });
      await expect(listMemberCandidates(input)).rejects.toMatchObject({ status, code });
      expect(db.select).toHaveBeenCalledOnce();
      expect(membership.innerJoin).toHaveBeenCalledWith(
        workspaces,
        eq(workspaceMemberships.workspaceId, workspaces.id),
      );
      expect(membership.where).toHaveBeenCalledWith(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, requesterId),
        ),
      );
    },
  );
  it("소유자는 전체 사용자와 현재 워크스페이스의 멤버 여부만 조회한다", async () => {
    const { list, count } = mockQueries();
    await expect(listMemberCandidates(input)).resolves.toEqual({
      users: candidates,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    expect(db.select).toHaveBeenNthCalledWith(1, {
      role: workspaceMemberships.role,
      isDefault: workspaces.isDefault,
    });
    expect(db.select).toHaveBeenNthCalledWith(3, {
      id: users.id,
      name: users.name,
      email: users.email,
      isMember: sql<boolean>`${workspaceMemberships.id} is not null`,
    });
    expect(list.from).toHaveBeenCalledWith(users);
    expect(count.from).toHaveBeenCalledWith(users);
    expect(list.leftJoin).toHaveBeenCalledWith(
      workspaceMemberships,
      and(
        eq(workspaceMemberships.userId, users.id),
        eq(workspaceMemberships.workspaceId, workspaceId),
      ),
    );
    expect(list.orderBy).toHaveBeenCalledWith(asc(users.name), asc(users.id));
    expect(list.where).toHaveBeenCalledWith(undefined);
  });
  it.each([
    ["김", "%김%"],
    ["@example.com", "%@example.com%"],
    ["50%_\\", "%50\\%\\_\\\\%"],
  ])("이름과 이메일 부분 검색 및 특수문자 이스케이프: %s", async (search, pattern) => {
    const { list, count } = mockQueries({ total: 5 });
    const result = await listMemberCandidates({ ...input, search, page: 2, limit: 2 });
    const condition = or(ilike(users.name, pattern), ilike(users.email, pattern));
    expect(list.where).toHaveBeenCalledWith(condition);
    expect(count.where).toHaveBeenCalledWith(condition);
    expect(list.limit).toHaveBeenCalledWith(2);
    expect(list.offset).toHaveBeenCalledWith(2);
    expect(result.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });
  it("검색 결과가 없으면 빈 목록과 0페이지를 반환한다", async () => {
    mockQueries({ total: 0, rows: [] });
    await expect(listMemberCandidates(input)).resolves.toEqual({
      users: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });
});

describe("GET /workspaces/:workspaceId/member-candidates", () => {
  it.each([undefined, "Bearer invalid-token"])(
    "미인증 요청을 401로 차단한다: %s",
    async (authorization) => {
      const pending = request(appUrl()).get(`/workspaces/${workspaceId}/member-candidates`);
      if (authorization) pending.set("Authorization", authorization);
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
      expect(db.select).not.toHaveBeenCalled();
    },
  );
  it.each([
    [null, false, 404, "WORKSPACE_NOT_FOUND"],
    ["member", false, 403, "MEMBER_SEARCH_FORBIDDEN"],
    ["owner", true, 403, "MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN"],
  ] as const)(
    "권한 %s·기본 워크스페이스 %s의 HTTP 오류 계약",
    async (role, isDefault, status, code) => {
      mockQueries({ role, isDefault });
      const response = await get();
      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(code);
      expect(db.select).toHaveBeenCalledOnce();
    },
  );
  it("기본 페이지와 공개 필드 및 기존 멤버를 반환한다", async () => {
    const { list } = mockQueries();
    const response = await get({ search: "  " });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      users: candidates,
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
    expect(list.limit).toHaveBeenCalledWith(20);
    expect(list.offset).toHaveBeenCalledWith(0);
    expect(list.where).toHaveBeenCalledWith(undefined);
  });
  it("검색어 공백을 제거하고 요청한 페이지를 적용한다", async () => {
    const { list } = mockQueries({ total: 5 });
    const response = await get({ search: "  @example.com  ", page: 2, limit: 2 });
    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(list.where).toHaveBeenCalledWith(
      or(ilike(users.name, "%@example.com%"), ilike(users.email, "%@example.com%")),
    );
    expect(list.offset).toHaveBeenCalledWith(2);
  });
  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 0 },
    { limit: 101 },
    { search: "a".repeat(101) },
    { search: ["a", "b"] },
  ])("잘못된 query는 DB 조회 없이 400: %j", async (query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.select).not.toHaveBeenCalled();
  });
  it("잘못된 워크스페이스 UUID는 400이다", async () => {
    expect((await get({}, "invalid")).status).toBe(400);
    expect(db.select).not.toHaveBeenCalled();
  });
  it("범위를 벗어난 페이지는 빈 목록과 실제 전체 수를 반환한다", async () => {
    mockQueries({ total: 2, rows: [] });
    const response = await get({ page: 3, limit: 2 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      users: [],
      pagination: { page: 3, limit: 2, total: 2, totalPages: 1 },
    });
  });
  it("DB 오류는 내부 상세 없이 공통 500으로 반환한다", async () => {
    mockQueries({ error: new Error("candidate query failed") });
    const response = await get();
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(response.body)).not.toContain("candidate query failed");
  });
});
