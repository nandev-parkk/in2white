import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { useTestServer } from "./test-server";
import { db } from "@/db/client";
import { signAdminAccessToken } from "@/lib/admin-jwt";
import { signAccessToken } from "@/lib/jwt";
import { adminWhiteboardDocumentListQuerySchema } from "@/schemas/admin-whiteboard-document.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import * as adminWhiteboardDocumentService from "@/services/admin-whiteboard-document.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn(), transaction: vi.fn() },
}));
vi.mock("@/services/admin-whiteboard-document.service");
vi.mock("@/services/admin-audit-log.service");

const appUrl = useTestServer(() => createApp());

/* 컨트롤러가 트랜잭션 핸들을 서비스와 감사 로그에 같은 값으로 넘기는지 확인하기 위한 표식이다. */
const transactionHandle = { handle: "tx" };

const documentId = "550e8400-e29b-41d4-a716-446655440020";
const projectId = "550e8400-e29b-41d4-a716-446655440010";
const workspaceId = "550e8400-e29b-41d4-a716-446655440002";
const creatorId = "550e8400-e29b-41d4-a716-446655440001";
const createdAt = new Date("2026-09-20T00:00:00.000Z");
const updatedAt = new Date("2026-09-21T00:00:00.000Z");
const deletedAt = new Date("2026-09-22T00:00:00.000Z");

const whiteboardDocument = {
  id: documentId,
  name: "Sprint Board",
  deletedAt: null,
  createdAt,
  updatedAt,
  project: { id: projectId, name: "Launch Plan", deletedAt: null },
  workspace: { id: workspaceId, name: "Team Workspace" },
  creator: { id: creatorId, name: "Kim Owner", email: "owner@example.com" },
};
const serializedDocument = {
  ...whiteboardDocument,
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

describe("adminWhiteboardDocumentListQuerySchema", () => {
  it("기본값을 채우고 검색어를 trim한다", () => {
    expect(adminWhiteboardDocumentListQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
      search: undefined,
      status: "all",
      projectId: undefined,
    });
    expect(adminWhiteboardDocumentListQuerySchema.parse({ search: "  Sprint  " }).search).toBe(
      "Sprint",
    );
  });

  it.each([
    { label: "삭제 상태", query: { status: "archived" } },
    { label: "프로젝트 ID", query: { projectId: "not-a-uuid" } },
  ])("잘못된 $label을 거부한다", ({ query }) => {
    expect(() => adminWhiteboardDocumentListQuerySchema.parse(query)).toThrow();
  });
});

describe("GET /admin/whiteboard-documents", () => {
  it("프로젝트·워크스페이스·생성자를 포함한 목록을 반환한다", async () => {
    vi.mocked(adminWhiteboardDocumentService.listWhiteboardDocuments).mockResolvedValue({
      whiteboardDocuments: [whiteboardDocument],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const response = await request(appUrl())
      .get("/admin/whiteboard-documents")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      whiteboardDocuments: [serializedDocument],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("필터를 서비스에 전달하며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWhiteboardDocumentService.listWhiteboardDocuments).mockResolvedValue({
      whiteboardDocuments: [],
      pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
    });

    const response = await request(appUrl())
      .get("/admin/whiteboard-documents")
      .query({ search: "  Sprint  ", status: "deleted", projectId, page: "2", limit: "5" })
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(adminWhiteboardDocumentService.listWhiteboardDocuments).toHaveBeenCalledWith({
      search: "Sprint",
      status: "deleted",
      projectId,
      page: 2,
      limit: 5,
    });
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).get("/admin/whiteboard-documents");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(adminWhiteboardDocumentService.listWhiteboardDocuments).not.toHaveBeenCalled();
  });

  it("제품 Access Token은 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/whiteboard-documents")
      .set("Authorization", await productAuthHeader());

    expect(response.status).toBe(401);
    expect(adminWhiteboardDocumentService.listWhiteboardDocuments).not.toHaveBeenCalled();
  });

  it("잘못된 status는 400이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .get("/admin/whiteboard-documents")
      .query({ status: "archived" })
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(adminWhiteboardDocumentService.listWhiteboardDocuments).not.toHaveBeenCalled();
  });
});

describe("DELETE /admin/whiteboard-documents/:documentId", () => {
  it("소프트 삭제하고 같은 트랜잭션의 감사 로그에 남긴다", async () => {
    vi.mocked(adminWhiteboardDocumentService.deleteWhiteboardDocument).mockResolvedValue({
      ...whiteboardDocument,
      deletedAt,
    });

    const response = await request(appUrl())
      .delete(`/admin/whiteboard-documents/${documentId}`)
      .set("Authorization", await adminAuthHeader())
      .set("User-Agent", "admin-console-test");

    expect(response.status).toBe(204);
    expect(adminWhiteboardDocumentService.deleteWhiteboardDocument).toHaveBeenCalledWith(
      transactionHandle,
      documentId,
    );
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        adminId: "admin-1",
        action: "whiteboard-document.delete",
        targetType: "whiteboard_document",
        targetId: documentId,
        userAgent: "admin-console-test",
      }),
    );
  });

  /* 복구 가능한 삭제이므로 어느 프로젝트의 무엇을 지웠는지만 남으면 충분하다. */
  it("감사 로그 metadata에 프로젝트와 이름을 남긴다", async () => {
    vi.mocked(adminWhiteboardDocumentService.deleteWhiteboardDocument).mockResolvedValue({
      ...whiteboardDocument,
      deletedAt,
    });

    await request(appUrl())
      .delete(`/admin/whiteboard-documents/${documentId}`)
      .set("Authorization", await adminAuthHeader());

    const entry = vi.mocked(recordAuditLog).mock.calls[0]![1];
    expect(entry.metadata).toMatchObject({
      before: { name: "Sprint Board", projectId, projectName: "Launch Plan" },
    });
  });

  it("이미 삭제된 문서는 404이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWhiteboardDocumentService.deleteWhiteboardDocument).mockRejectedValue(
      new HttpError(404, "WHITEBOARD_DOCUMENT_NOT_FOUND", "화이트보드 문서를 찾을 수 없습니다"),
    );

    const response = await request(appUrl())
      .delete(`/admin/whiteboard-documents/${documentId}`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WHITEBOARD_DOCUMENT_NOT_FOUND");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("UUID가 아닌 documentId는 400이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl())
      .delete("/admin/whiteboard-documents/not-a-uuid")
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(adminWhiteboardDocumentService.deleteWhiteboardDocument).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).delete(`/admin/whiteboard-documents/${documentId}`);

    expect(response.status).toBe(401);
    expect(adminWhiteboardDocumentService.deleteWhiteboardDocument).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});

describe("POST /admin/whiteboard-documents/:documentId/restore", () => {
  it("복구한 문서를 반환하고 같은 트랜잭션의 감사 로그에 남긴다", async () => {
    vi.mocked(adminWhiteboardDocumentService.restoreWhiteboardDocument).mockResolvedValue(
      whiteboardDocument,
    );

    const response = await request(appUrl())
      .post(`/admin/whiteboard-documents/${documentId}/restore`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ whiteboardDocument: serializedDocument });
    expect(adminWhiteboardDocumentService.restoreWhiteboardDocument).toHaveBeenCalledWith(
      transactionHandle,
      documentId,
    );
    expect(recordAuditLog).toHaveBeenCalledOnce();
    expect(recordAuditLog).toHaveBeenCalledWith(
      transactionHandle,
      expect.objectContaining({
        action: "whiteboard-document.restore",
        targetType: "whiteboard_document",
        targetId: documentId,
      }),
    );
  });

  /*
   * 프로젝트가 삭제된 채로 복구하면 제품에서는 여전히 보이지 않는다. 응답에 그 사실이
   * 담겨야 화면이 "프로젝트도 복구해야 합니다"를 안내할 수 있다.
   */
  it("프로젝트가 삭제된 문서도 복구하고 프로젝트 삭제 상태를 응답에 담는다", async () => {
    vi.mocked(adminWhiteboardDocumentService.restoreWhiteboardDocument).mockResolvedValue({
      ...whiteboardDocument,
      project: { id: projectId, name: "Launch Plan", deletedAt },
    });

    const response = await request(appUrl())
      .post(`/admin/whiteboard-documents/${documentId}/restore`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(200);
    expect(response.body.whiteboardDocument.project).toEqual({
      id: projectId,
      name: "Launch Plan",
      deletedAt: deletedAt.toISOString(),
    });
  });

  it("삭제되지 않은 문서 복구는 400이며 감사 로그를 남기지 않는다", async () => {
    vi.mocked(adminWhiteboardDocumentService.restoreWhiteboardDocument).mockRejectedValue(
      new HttpError(400, "RESOURCE_NOT_DELETED", "삭제되지 않은 리소스입니다"),
    );

    const response = await request(appUrl())
      .post(`/admin/whiteboard-documents/${documentId}/restore`)
      .set("Authorization", await adminAuthHeader());

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("RESOURCE_NOT_DELETED");
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("인증이 없으면 401이며 서비스를 호출하지 않는다", async () => {
    const response = await request(appUrl()).post(
      `/admin/whiteboard-documents/${documentId}/restore`,
    );

    expect(response.status).toBe(401);
    expect(adminWhiteboardDocumentService.restoreWhiteboardDocument).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
