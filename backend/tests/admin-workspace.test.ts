import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";
import {
  addWorkspaceMemberSchema,
  adminWorkspaceListQuerySchema,
  transferWorkspaceOwnerSchema,
  updateWorkspaceSchema,
} from "@/schemas/admin-workspace.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import * as adminWorkspaceService from "@/services/admin-workspace.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/services/admin-workspace.service");
vi.mock("@/services/admin-audit-log.service");

const appUrl = useTestServer(() => createApp());

/* 컨트롤러가 트랜잭션 핸들을 서비스와 감사 로그에 같은 값으로 넘기는지 확인하기 위한 표식이다. */
const transactionHandle = { handle: "tx" };

const workspaceId = "550e8400-e29b-41d4-a716-446655440002";
const ownerId = "550e8400-e29b-41d4-a716-446655440001";
const memberId = "550e8400-e29b-41d4-a716-446655440003";
const createdAt = new Date("2026-09-20T00:00:00.000Z");
const updatedAt = new Date("2026-09-21T00:00:00.000Z");

const workspaceSummary = {
  id: workspaceId,
  name: "Team Workspace",
  isDefault: false,
  createdAt,
  updatedAt,
};
const serializedWorkspaceSummary = {
  id: workspaceId,
  name: "Team Workspace",
  isDefault: false,
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
};
const owner = { id: ownerId, name: "Kim Owner", email: "owner@example.com" };
const member = {
  userId: memberId,
  name: "Lee Member",
  email: "member@example.com",
  deactivatedAt: null,
  role: "member" as const,
  joinedAt: createdAt,
};

async function adminAuthHeader(sub = "admin-1") {
  const token = await signAdminAccessToken({
    sub,
    email: "admin@example.com",
    sid: "admin-sid-1",
    ver: 0,
  });
  return `Bearer ${token}`;
}

async function productAuthHeader() {
  const token = await signAccessToken({
    sub: "user-1",
    email: "user@example.com",
    sid: "session-1",
    ver: 0,
  });
  return `Bearer ${token}`;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.transaction).mockImplementation(async (callback) =>
    callback(transactionHandle as never),
  );
});

describe("adminWorkspaceListQuerySchema", () => {
  it("페이지 기본값을 채우고 검색어를 trim한다", () => {
    expect(adminWorkspaceListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      search: undefined,
    });
    expect(adminWorkspaceListQuerySchema.parse({ search: "  Team  " }).search).toBe("Team");
  });
});

describe("updateWorkspaceSchema", () => {
  it("이름을 trim한다", () => {
    expect(updateWorkspaceSchema.parse({ name: "  바뀐 이름  " })).toEqual({ name: "바뀐 이름" });
  });

  it.each([
    { label: "이름 공백", body: { name: "   " } },
    { label: "이름 누락", body: {} },
    { label: "정의하지 않은 필드", body: { name: "바뀐 이름", isDefault: true } },
  ])("$label 요청을 거부한다", ({ body }) => {
    expect(() => updateWorkspaceSchema.parse(body)).toThrow();
  });
});

describe("transferWorkspaceOwnerSchema / addWorkspaceMemberSchema", () => {
  it("대상 사용자 UUID만 허용한다", () => {
    expect(transferWorkspaceOwnerSchema.parse({ userId: memberId })).toEqual({ userId: memberId });
    expect(addWorkspaceMemberSchema.parse({ userId: memberId })).toEqual({ userId: memberId });
    expect(() => transferWorkspaceOwnerSchema.parse({ userId: "not-a-uuid" })).toThrow();
    expect(() => addWorkspaceMemberSchema.parse({ userId: memberId, role: "owner" })).toThrow();
  });
});

describe("GET /admin/workspaces", () => {
  const listResult = {
    workspaces: [{ ...workspaceSummary, owner, memberCount: 3, projectCount: 2 }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  it("소유자와 멤버·프로젝트 수를 포함한 목록을 반환한다", async () => {
    vi.mocked(adminWorkspaceService.listWorkspaces).mockResolvedValue(listResult);

    const response = await request(appUrl())
      .get("/admin/workspaces")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      workspaces: [{ ...serializedWorkspaceSummary, owner, memberCount: 3, projectCount: 2 }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("검색어와 페이지를 서비스에 전달하며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.listWorkspaces).mockResolvedValue({
      workspaces: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });

    const response = await request(appUrl())
      .get("/admin/workspaces")
      .query({ search: "  Team  ", page: "2", limit: "5" })
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(adminWorkspaceService.listWorkspaces).toHaveBeenCalledWith({
      search: "Team",
      page: 2,
      limit: 5,
    });
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get("/admin/workspaces");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(adminWorkspaceService.listWorkspaces).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/workspaces")
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminWorkspaceService.listWorkspaces).not.toHaveBeenCalled();
  });

  it.each([
    { label: "page", query: { page: "0" } },
    { label: "limit", query: { limit: "101" } },
  ])("잘못된 $label query는 400이며 서비스를 호출하지 않는다", async ({ query }) => {
    const response = await request(appUrl())
      .get("/admin/workspaces")
      .query(query)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(adminWorkspaceService.listWorkspaces).not.toHaveBeenCalled();
  });

  it("DB 오류를 공통 500 응답으로 변환한다", async () => {
    vi.mocked(adminWorkspaceService.listWorkspaces).mockRejectedValue(new Error("list failed"));

    const response = await request(appUrl())
      .get("/admin/workspaces")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("GET /admin/workspaces/:workspaceId", () => {
  const detail = {
    workspace: { ...workspaceSummary, owner },
    members: [
      {
        userId: ownerId,
        name: "Kim Owner",
        email: "owner@example.com",
        deactivatedAt: null,
        role: "owner" as const,
        joinedAt: createdAt,
      },
      member,
    ],
    projects: [
      {
        id: "550e8400-e29b-41d4-a716-446655440010",
        name: "Deleted Project",
        creator: { id: ownerId, name: "Kim Owner" },
        whiteboardDocumentCount: 0,
        deletedAt: updatedAt,
        createdAt,
      },
    ],
  };

  it("멤버·프로젝트 목록을 반환하고 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.getWorkspaceDetail).mockResolvedValue(detail);

    const response = await request(appUrl())
      .get(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(adminWorkspaceService.getWorkspaceDetail).toHaveBeenCalledWith(workspaceId);
    expect(response.body).toEqual({
      workspace: { ...serializedWorkspaceSummary, owner },
      members: [
        {
          userId: ownerId,
          name: "Kim Owner",
          email: "owner@example.com",
          deactivatedAt: null,
          role: "owner",
          joinedAt: createdAt.toISOString(),
        },
        { ...member, joinedAt: createdAt.toISOString() },
      ],
      projects: [
        {
          id: "550e8400-e29b-41d4-a716-446655440010",
          name: "Deleted Project",
          creator: { id: ownerId, name: "Kim Owner" },
          whiteboardDocumentCount: 0,
          deletedAt: updatedAt.toISOString(),
          createdAt: createdAt.toISOString(),
        },
      ],
    });
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get(`/admin/workspaces/${workspaceId}`);

    expect(response.status).toBe(401);
    expect(adminWorkspaceService.getWorkspaceDetail).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminWorkspaceService.getWorkspaceDetail).not.toHaveBeenCalled();
  });

  it("UUID가 아닌 workspaceId는 400이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/workspaces/not-a-uuid")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(adminWorkspaceService.getWorkspaceDetail).not.toHaveBeenCalled();
  });

  it("없는 워크스페이스는 404를 반환한다", async () => {
    vi.mocked(adminWorkspaceService.getWorkspaceDetail).mockRejectedValue(
      new HttpError(404, "WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .get(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });
});

describe("PATCH /admin/workspaces/:workspaceId", () => {
  const renamed = { ...workspaceSummary, name: "바뀐 이름" };

  it("이름을 변경하고 변경 전후를 같은 트랜잭션의 감사 로그에 남긴다", async () => {
    vi.mocked(adminWorkspaceService.updateWorkspace).mockResolvedValue({
      previousWorkspace: workspaceSummary,
      workspace: renamed,
    });

    const response = await request(appUrl())
      .patch(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await adminAuthHeader())
      .set("User-Agent", "admin-console-test")
      .send({ name: "  바뀐 이름  " });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      workspace: { ...serializedWorkspaceSummary, name: "바뀐 이름" },
    });
    expect(adminWorkspaceService.updateWorkspace).toHaveBeenCalledWith(transactionHandle, {
      workspaceId,
      name: "바뀐 이름",
    });
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "workspace.update",
        targetType: "workspace",
        targetId: workspaceId,
        metadata: { before: { name: "Team Workspace" }, after: { name: "바뀐 이름" } },
        userAgent: "admin-console-test",
      }),
    );
  });

  it("인증이 없으면 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .patch(`/admin/workspaces/${workspaceId}`)
      .send({ name: "바뀐 이름" });

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.updateWorkspace).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .patch(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await productAuthHeader())
      .send({ name: "바뀐 이름" });

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.updateWorkspace).not.toHaveBeenCalled();
  });

  it.each([
    { label: "빈 본문", path: workspaceId, payload: {} },
    { label: "UUID가 아닌 workspaceId", path: "not-a-uuid", payload: { name: "바뀐 이름" } },
    { label: "정의하지 않은 필드", path: workspaceId, payload: { name: "바뀐 이름", ownerId } },
  ])("$label 요청은 400이며 트랜잭션을 열지 않는다", async ({ path, payload }) => {
    const response = await request(appUrl())
      .patch(`/admin/workspaces/${path}`)
      .set("Authorization", await adminAuthHeader())
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  /* 기본 워크스페이스의 이름을 어드민이 바꾸면 제품의 기본 워크스페이스 표기가 어긋난다. */
  it("기본 워크스페이스는 403이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.updateWorkspace).mockRejectedValue(
      new HttpError(
        403,
        "WORKSPACE_DEFAULT_UPDATE_FORBIDDEN",
        "기본 워크스페이스의 이름은 변경할 수 없습니다",
      ),
    );

    const response = await request(appUrl())
      .patch(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await adminAuthHeader())
      .send({ name: "바뀐 이름" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("WORKSPACE_DEFAULT_UPDATE_FORBIDDEN");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("없는 워크스페이스는 404이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.updateWorkspace).mockRejectedValue(
      new HttpError(404, "WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .patch(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await adminAuthHeader())
      .send({ name: "바뀐 이름" });

    expect(response.status).toBe(404);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("POST /admin/workspaces/:workspaceId/transfer-owner", () => {
  const newOwner = { id: memberId, name: "Lee Member", email: "member@example.com" };

  it("소유자를 이전하고 변경 전후 소유자를 감사 로그에 남긴다", async () => {
    vi.mocked(adminWorkspaceService.transferWorkspaceOwner).mockResolvedValue({
      workspace: workspaceSummary,
      previousOwner: owner,
      newOwner,
    });

    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/transfer-owner`)
      .set("Authorization", await adminAuthHeader())
      .send({ userId: memberId });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ workspace: serializedWorkspaceSummary, owner: newOwner });
    expect(adminWorkspaceService.transferWorkspaceOwner).toHaveBeenCalledWith(transactionHandle, {
      workspaceId,
      userId: memberId,
    });
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "workspace.transfer-owner",
        targetType: "workspace",
        targetId: workspaceId,
        metadata: {
          before: { ownerId, ownerEmail: "owner@example.com" },
          after: { ownerId: memberId, ownerEmail: "member@example.com" },
        },
      }),
    );
  });

  it("인증이 없으면 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/transfer-owner`)
      .send({ userId: memberId });

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.transferWorkspaceOwner).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/transfer-owner`)
      .set("Authorization", await productAuthHeader())
      .send({ userId: memberId });

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.transferWorkspaceOwner).not.toHaveBeenCalled();
  });

  it.each([
    { label: "대상 누락", payload: {} },
    { label: "UUID가 아닌 대상", payload: { userId: "not-a-uuid" } },
  ])("$label 요청은 400이며 트랜잭션을 열지 않는다", async ({ payload }) => {
    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/transfer-owner`)
      .set("Authorization", await adminAuthHeader())
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("대상이 멤버가 아니면 400이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.transferWorkspaceOwner).mockRejectedValue(
      new HttpError(
        400,
        "TRANSFER_TARGET_NOT_MEMBER",
        "소유자 이전 대상은 워크스페이스 멤버여야 합니다",
      ),
    );

    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/transfer-owner`)
      .set("Authorization", await adminAuthHeader())
      .send({ userId: memberId });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("TRANSFER_TARGET_NOT_MEMBER");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("POST /admin/workspaces/:workspaceId/members", () => {
  it("멤버를 추가하고 같은 트랜잭션에 감사 로그를 1건 남긴다", async () => {
    vi.mocked(adminWorkspaceService.addWorkspaceMember).mockResolvedValue({
      workspace: workspaceSummary,
      member,
    });

    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/members`)
      .set("Authorization", await adminAuthHeader())
      .send({ userId: memberId });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ member: { ...member, joinedAt: createdAt.toISOString() } });
    expect(adminWorkspaceService.addWorkspaceMember).toHaveBeenCalledWith(transactionHandle, {
      workspaceId,
      userId: memberId,
    });
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "workspace.member-add",
        targetType: "workspace",
        targetId: workspaceId,
        metadata: { member: { userId: memberId, email: "member@example.com", role: "member" } },
      }),
    );
  });

  it("인증이 없으면 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/members`)
      .send({ userId: memberId });

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.addWorkspaceMember).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/members`)
      .set("Authorization", await productAuthHeader())
      .send({ userId: memberId });

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.addWorkspaceMember).not.toHaveBeenCalled();
  });

  it("UUID가 아닌 대상은 400이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/members`)
      .set("Authorization", await adminAuthHeader())
      .send({ userId: "not-a-uuid" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  /* 기본 워크스페이스는 1인용이다. 멤버가 늘면 제품의 개인 공간 가정이 깨진다. */
  it("기본 워크스페이스는 403이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.addWorkspaceMember).mockRejectedValue(
      new HttpError(
        403,
        "MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN",
        "기본 워크스페이스에는 멤버를 추가할 수 없습니다",
      ),
    );

    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/members`)
      .set("Authorization", await adminAuthHeader())
      .send({ userId: memberId });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("이미 멤버면 409이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.addWorkspaceMember).mockRejectedValue(
      new HttpError(409, "MEMBER_ALREADY_EXISTS", "이미 워크스페이스 멤버입니다"),
    );

    const response = await request(appUrl())
      .post(`/admin/workspaces/${workspaceId}/members`)
      .set("Authorization", await adminAuthHeader())
      .send({ userId: memberId });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("MEMBER_ALREADY_EXISTS");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/workspaces/:workspaceId/members/:userId", () => {
  it("멤버를 제거하고 같은 트랜잭션에 감사 로그를 1건 남긴다", async () => {
    vi.mocked(adminWorkspaceService.removeWorkspaceMember).mockResolvedValue({
      workspace: workspaceSummary,
      member,
    });

    const response = await request(appUrl())
      .delete(`/admin/workspaces/${workspaceId}/members/${memberId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(204);
    expect(adminWorkspaceService.removeWorkspaceMember).toHaveBeenCalledWith(transactionHandle, {
      workspaceId,
      userId: memberId,
    });
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "workspace.member-remove",
        targetType: "workspace",
        targetId: workspaceId,
        metadata: {
          before: { member: { userId: memberId, email: "member@example.com", role: "member" } },
        },
      }),
    );
  });

  it("인증이 없으면 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl()).delete(
      `/admin/workspaces/${workspaceId}/members/${memberId}`,
    );

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.removeWorkspaceMember).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .delete(`/admin/workspaces/${workspaceId}/members/${memberId}`)
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.removeWorkspaceMember).not.toHaveBeenCalled();
  });

  it("UUID가 아닌 userId는 400이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .delete(`/admin/workspaces/${workspaceId}/members/not-a-uuid`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  /* 소유자를 제거하면 소유자가 멤버 목록에 없는 워크스페이스가 남는다. 이전이 먼저다. */
  it("소유자 제거는 403이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.removeWorkspaceMember).mockRejectedValue(
      new HttpError(
        403,
        "MEMBER_OWNER_REMOVE_FORBIDDEN",
        "워크스페이스 소유자는 제거할 수 없습니다. 소유자를 먼저 이전해주세요",
      ),
    );

    const response = await request(appUrl())
      .delete(`/admin/workspaces/${workspaceId}/members/${ownerId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("MEMBER_OWNER_REMOVE_FORBIDDEN");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/workspaces/:workspaceId", () => {
  it("워크스페이스를 삭제하고 같은 트랜잭션에 감사 로그를 1건 남긴다", async () => {
    vi.mocked(adminWorkspaceService.deleteWorkspace).mockResolvedValue({
      ...workspaceSummary,
      owner,
    });

    const response = await request(appUrl())
      .delete(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(204);
    expect(adminWorkspaceService.deleteWorkspace).toHaveBeenCalledWith(
      transactionHandle,
      workspaceId,
    );
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "workspace.delete",
        targetType: "workspace",
        targetId: workspaceId,
        metadata: {
          before: { name: "Team Workspace", ownerId, ownerEmail: "owner@example.com" },
        },
      }),
    );
  });

  it("인증이 없으면 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl()).delete(`/admin/workspaces/${workspaceId}`);

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.deleteWorkspace).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 트랜잭션을 열지 않는다", async () => {
    const response = await request(appUrl())
      .delete(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(adminWorkspaceService.deleteWorkspace).not.toHaveBeenCalled();
  });

  /* 기본 워크스페이스가 사라지면 제품의 기본 화면이 빈다. 사용자 하드 삭제로만 함께 사라진다. */
  it("기본 워크스페이스는 403이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.deleteWorkspace).mockRejectedValue(
      new HttpError(
        403,
        "WORKSPACE_DEFAULT_DELETE_FORBIDDEN",
        "기본 워크스페이스는 삭제할 수 없습니다",
      ),
    );

    const response = await request(appUrl())
      .delete(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("WORKSPACE_DEFAULT_DELETE_FORBIDDEN");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("없는 워크스페이스는 404이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWorkspaceService.deleteWorkspace).mockRejectedValue(
      new HttpError(404, "WORKSPACE_NOT_FOUND", "워크스페이스를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .delete(`/admin/workspaces/${workspaceId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});
