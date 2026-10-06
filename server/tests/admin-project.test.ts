import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";
import { adminProjectListQuerySchema } from "@/schemas/admin-project.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import * as adminProjectService from "@/services/admin-project.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/services/admin-project.service");
vi.mock("@/services/admin-audit-log.service");

const appUrl = useTestServer(() => createApp());

/* 컨트롤러가 트랜잭션 핸들을 서비스와 감사 로그에 같은 값으로 넘기는지 확인하기 위한 표식이다. */
const transactionHandle = { handle: "tx" };

const projectId = "550e8400-e29b-41d4-a716-446655440010";
const workspaceId = "550e8400-e29b-41d4-a716-446655440002";
const creatorId = "550e8400-e29b-41d4-a716-446655440001";
const documentId = "550e8400-e29b-41d4-a716-446655440020";
const createdAt = new Date("2026-09-20T00:00:00.000Z");
const updatedAt = new Date("2026-09-21T00:00:00.000Z");
const deletedAt = new Date("2026-09-22T00:00:00.000Z");

const workspace = { id: workspaceId, name: "Team Workspace" };
const creator = { id: creatorId, name: "Kim Owner", email: "owner@example.com" };
const project = {
  id: projectId,
  name: "Launch Plan",
  description: "설명",
  deletedAt: null,
  createdAt,
  updatedAt,
  workspace,
  creator,
};
const serializedProject = {
  ...project,
  createdAt: createdAt.toISOString(),
  updatedAt: updatedAt.toISOString(),
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

describe("adminProjectListQuerySchema", () => {
  it("기본값을 채우고 검색어를 trim한다", () => {
    expect(adminProjectListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      search: undefined,
      status: "all",
      workspaceId: undefined,
    });
    expect(adminProjectListQuerySchema.parse({ search: "  Launch  " }).search).toBe("Launch");
  });

  it.each([
    { label: "삭제 상태", query: { status: "archived" } },
    { label: "워크스페이스 ID", query: { workspaceId: "not-a-uuid" } },
  ])("잘못된 $label을 거부한다", ({ query }) => {
    expect(() => adminProjectListQuerySchema.parse(query)).toThrow();
  });
});

describe("GET /admin/projects", () => {
  const listResult = {
    projects: [{ ...project, whiteboardDocumentCount: 2 }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  it("워크스페이스·생성자와 문서 수를 포함한 목록을 반환한다", async () => {
    vi.mocked(adminProjectService.listProjects).mockResolvedValue(listResult);

    const response = await request(appUrl())
      .get("/admin/projects")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projects: [{ ...serializedProject, whiteboardDocumentCount: 2 }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("필터를 서비스에 전달하며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminProjectService.listProjects).mockResolvedValue({
      projects: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });

    const response = await request(appUrl())
      .get("/admin/projects")
      .query({ search: "  Launch  ", status: "deleted", workspaceId, page: "2", limit: "5" })
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(adminProjectService.listProjects).toHaveBeenCalledWith({
      search: "Launch",
      status: "deleted",
      workspaceId,
      page: 2,
      limit: 5,
    });
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get("/admin/projects");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(adminProjectService.listProjects).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/projects")
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminProjectService.listProjects).not.toHaveBeenCalled();
  });

  it("잘못된 status는 400이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/projects")
      .query({ status: "archived" })
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(adminProjectService.listProjects).not.toHaveBeenCalled();
  });
});

describe("GET /admin/projects/:projectId", () => {
  const detail = {
    project,
    whiteboardDocuments: [
      {
        id: documentId,
        name: "Sprint Board",
        creator: { id: creatorId, name: "Kim Owner" },
        deletedAt,
        createdAt,
        updatedAt,
      },
    ],
  };

  it("문서 목록을 반환하고 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminProjectService.getProjectDetail).mockResolvedValue(detail);

    const response = await request(appUrl())
      .get(`/admin/projects/${projectId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(adminProjectService.getProjectDetail).toHaveBeenCalledWith(projectId);
    expect(response.body).toEqual({
      project: serializedProject,
      whiteboardDocuments: [
        {
          id: documentId,
          name: "Sprint Board",
          creator: { id: creatorId, name: "Kim Owner" },
          deletedAt: deletedAt.toISOString(),
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ],
    });
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("UUID가 아닌 projectId는 400이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/projects/not-a-uuid")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(adminProjectService.getProjectDetail).not.toHaveBeenCalled();
  });

  it("없는 프로젝트는 404를 반환한다", async () => {
    vi.mocked(adminProjectService.getProjectDetail).mockRejectedValue(
      new HttpError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .get(`/admin/projects/${projectId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get(`/admin/projects/${projectId}`);

    expect(response.status).toBe(401);
    expect(adminProjectService.getProjectDetail).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/projects/:projectId", () => {
  it("소프트 삭제하고 같은 트랜잭션의 감사 로그에 남긴다", async () => {
    vi.mocked(adminProjectService.deleteProject).mockResolvedValue({ ...project, deletedAt });

    const response = await request(appUrl())
      .delete(`/admin/projects/${projectId}`)
      .set("Authorization", await adminAuthHeader())
      .set("User-Agent", "admin-console-test");

    expect(response.status).toBe(204);
    expect(adminProjectService.deleteProject).toHaveBeenCalledWith(transactionHandle, projectId);
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "project.delete",
        targetType: "project",
        targetId: projectId,
        userAgent: "admin-console-test",
      }),
    );
  });

  /* 복구 가능한 삭제이므로 어느 워크스페이스의 무엇을 지웠는지만 남으면 충분하다. */
  it("감사 로그 metadata에 워크스페이스와 이름을 남긴다", async () => {
    vi.mocked(adminProjectService.deleteProject).mockResolvedValue({ ...project, deletedAt });

    await request(appUrl())
      .delete(`/admin/projects/${projectId}`)
      .set("Authorization", await adminAuthHeader());

    const entry = vi.mocked(recordAuditLog).mock.calls[0]![1];
    expect(entry.metadata).toMatchObject({
      before: { name: "Launch Plan", workspaceId, workspaceName: "Team Workspace" },
    });
  });

  it("이미 삭제된 프로젝트는 404이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminProjectService.deleteProject).mockRejectedValue(
      new HttpError(404, "PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .delete(`/admin/projects/${projectId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).delete(`/admin/projects/${projectId}`);

    expect(response.status).toBe(401);
    expect(adminProjectService.deleteProject).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("UUID가 아닌 projectId는 400이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .delete("/admin/projects/not-a-uuid")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(adminProjectService.deleteProject).not.toHaveBeenCalled();
  });
});

describe("POST /admin/projects/:projectId/restore", () => {
  it("복구한 프로젝트를 반환하고 같은 트랜잭션의 감사 로그에 남긴다", async () => {
    vi.mocked(adminProjectService.restoreProject).mockResolvedValue(project);

    const response = await request(appUrl())
      .post(`/admin/projects/${projectId}/restore`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ project: serializedProject });
    expect(adminProjectService.restoreProject).toHaveBeenCalledWith(transactionHandle, projectId);
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        action: "project.restore",
        targetType: "project",
        targetId: projectId,
      }),
    );
  });

  it("삭제되지 않은 프로젝트 복구는 400이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminProjectService.restoreProject).mockRejectedValue(
      new HttpError(400, "RESOURCE_NOT_DELETED", "삭제되지 않은 리소스입니다"),
    );

    const response = await request(appUrl())
      .post(`/admin/projects/${projectId}/restore`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("RESOURCE_NOT_DELETED");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).post(`/admin/projects/${projectId}/restore`);

    expect(response.status).toBe(401);
    expect(adminProjectService.restoreProject).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .post(`/admin/projects/${projectId}/restore`)
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminProjectService.restoreProject).not.toHaveBeenCalled();
  });
});
