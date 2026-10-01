import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  deleteWhiteboardDocument,
  listWhiteboardDocuments,
  restoreWhiteboardDocument,
} from "@/services/admin-whiteboard-document.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/db/client", () => ({ db: { select: vi.fn() } }));

const documentId = "550e8400-e29b-41d4-a716-446655440020";
const projectId = "550e8400-e29b-41d4-a716-446655440010";
const workspaceId = "550e8400-e29b-41d4-a716-446655440002";
const creatorId = "550e8400-e29b-41d4-a716-446655440001";
const createdAt = new Date("2026-09-20T00:00:00.000Z");
const updatedAt = new Date("2026-09-21T00:00:00.000Z");
const deletedAt = new Date("2026-09-22T00:00:00.000Z");

/* 서비스가 join 컬럼을 평평하게 읽고 중첩 객체로 조립하는지 보기 위해 행은 평평하게 둔다. */
const documentRow = {
  id: documentId,
  name: "Sprint Board",
  deletedAt: null,
  createdAt,
  updatedAt,
};
const joinColumns = {
  projectId,
  projectName: "Launch Plan",
  projectDeletedAt: null,
  workspaceId,
  workspaceName: "Team Workspace",
  creatorId,
  creatorName: "Kim Owner",
  creatorEmail: "owner@example.com",
};
const documentItem = {
  ...documentRow,
  project: { id: projectId, name: "Launch Plan", deletedAt: null },
  workspace: { id: workspaceId, name: "Team Workspace" },
  creator: { id: creatorId, name: "Kim Owner", email: "owner@example.com" },
};

beforeEach(() => {
  vi.mocked(db.select).mockReset();
});

/*
 * drizzle 쿼리 빌더는 체이닝 끝에서 await된다. 마지막 메서드만 결과를 돌려주고 나머지는
 * 자기 자신을 돌려주는 스텁을 만들어, 서비스가 실제로 호출한 체인만 통과하게 둔다.
 */
function queryStub(methods: string[], rows: unknown[] | Error) {
  const stub: Record<string, unknown> = {};
  methods.forEach((method, index) => {
    if (index < methods.length - 1) {
      stub[method] = vi.fn().mockReturnValue(stub);
      return;
    }
    stub[method] =
      rows instanceof Error ? vi.fn().mockRejectedValue(rows) : vi.fn().mockResolvedValue(rows);
  });
  return stub;
}

function mockSelects(...stubs: Record<string, unknown>[]) {
  const mock = vi.mocked(db.select);
  stubs.forEach((stub) => mock.mockReturnValueOnce(stub as never));
}

/* 문서 → 프로젝트 → 워크스페이스 → 생성자 세 단계 join이다. */
const COUNT_CHAIN = ["from", "innerJoin", "innerJoin", "innerJoin", "where"];
const ROWS_CHAIN = [...COUNT_CHAIN, "orderBy", "limit", "offset"];

describe("listWhiteboardDocuments", () => {
  it("프로젝트·워크스페이스·생성자와 페이지 정보를 함께 반환한다", async () => {
    const countStub = queryStub(COUNT_CHAIN, [{ total: 3 }]);
    const rowsStub = queryStub(ROWS_CHAIN, [{ ...documentRow, ...joinColumns }]);
    mockSelects(countStub, rowsStub);

    await expect(listWhiteboardDocuments({ status: "all", page: 2, limit: 2 })).resolves.toEqual({
      whiteboardDocuments: [documentItem],
      pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
    });
    expect(rowsStub.limit).toHaveBeenCalledWith(2);
    expect(rowsStub.offset).toHaveBeenCalledWith(2);
  });

  /* 프로젝트가 삭제되면 문서는 제품에서 보이지 않는다. 그 사실이 목록에 드러나야 한다. */
  it("프로젝트 삭제 시각을 함께 반환한다", async () => {
    mockSelects(
      queryStub(COUNT_CHAIN, [{ total: 1 }]),
      queryStub(ROWS_CHAIN, [{ ...documentRow, ...joinColumns, projectDeletedAt: deletedAt }]),
    );

    const result = await listWhiteboardDocuments({ status: "all", page: 1, limit: 20 });

    expect(result.whiteboardDocuments[0]!.project).toEqual({
      id: projectId,
      name: "Launch Plan",
      deletedAt,
    });
  });

  it("status가 all이면 삭제 여부 조건을 걸지 않는다", async () => {
    const countStub = queryStub(COUNT_CHAIN, [{ total: 0 }]);
    mockSelects(countStub, queryStub(ROWS_CHAIN, []));

    await listWhiteboardDocuments({ status: "all", page: 1, limit: 20 });

    expect(countStub.where).toHaveBeenCalledWith(undefined);
  });

  it.each([
    { status: "active" as const, label: "활성" },
    { status: "deleted" as const, label: "삭제" },
  ])("status가 $status면 $label 조건을 두 쿼리에 같이 적용한다", async ({ status }) => {
    const countStub = queryStub(COUNT_CHAIN, [{ total: 0 }]);
    const rowsStub = queryStub(ROWS_CHAIN, []);
    mockSelects(countStub, rowsStub);

    await listWhiteboardDocuments({ status, page: 1, limit: 20 });

    const countWhere = vi.mocked(countStub.where as (condition: unknown) => unknown);
    const rowsWhere = vi.mocked(rowsStub.where as (condition: unknown) => unknown);
    expect(countWhere.mock.calls[0]![0]).toBeDefined();
    expect(rowsWhere.mock.calls[0]![0]).toEqual(countWhere.mock.calls[0]![0]);
  });

  it("프로젝트 조건과 검색어를 함께 적용한다", async () => {
    const countStub = queryStub(COUNT_CHAIN, [{ total: 0 }]);
    const rowsStub = queryStub(ROWS_CHAIN, []);
    mockSelects(countStub, rowsStub);

    await listWhiteboardDocuments({
      projectId,
      search: "Sprint",
      status: "active",
      page: 1,
      limit: 20,
    });

    const countWhere = vi.mocked(countStub.where as (condition: unknown) => unknown);
    const rowsWhere = vi.mocked(rowsStub.where as (condition: unknown) => unknown);
    expect(countWhere.mock.calls[0]![0]).toBeDefined();
    expect(rowsWhere.mock.calls[0]![0]).toEqual(countWhere.mock.calls[0]![0]);
  });
});

function mockChangeTransaction({
  documentRows = [{ ...documentRow, ...joinColumns }] as unknown[],
  updatedRows = [{ id: documentId }] as unknown[],
} = {}) {
  const selectStub = queryStub(
    ["from", "innerJoin", "innerJoin", "innerJoin", "where"],
    documentRows,
  );
  const updateStub = queryStub(["set", "where", "returning"], updatedRows);
  const tx = {
    select: vi.fn().mockReturnValue(selectStub),
    update: vi.fn().mockReturnValue(updateStub),
  };
  return { tx, selectStub, updateStub };
}

describe("deleteWhiteboardDocument", () => {
  it("deletedAt을 채우고 변경된 문서를 반환한다", async () => {
    const { tx, updateStub } = mockChangeTransaction();

    await expect(deleteWhiteboardDocument(tx as never, documentId)).resolves.toEqual({
      ...documentItem,
      deletedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(updateStub.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date), updatedAt: expect.any(Date) }),
    );
  });

  it("없는 문서는 404이며 update를 실행하지 않는다", async () => {
    const { tx } = mockChangeTransaction({ documentRows: [] });

    await expect(deleteWhiteboardDocument(tx as never, documentId)).rejects.toMatchObject({
      status: 404,
      code: "WHITEBOARD_DOCUMENT_NOT_FOUND",
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("이미 삭제된 문서는 404이며 update를 실행하지 않는다", async () => {
    const { tx } = mockChangeTransaction({
      documentRows: [{ ...documentRow, ...joinColumns, deletedAt }],
    });

    await expect(deleteWhiteboardDocument(tx as never, documentId)).rejects.toThrow(HttpError);
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("선행 조회와 update 사이에 사라지면 404다", async () => {
    const { tx } = mockChangeTransaction({ updatedRows: [] });

    await expect(deleteWhiteboardDocument(tx as never, documentId)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("restoreWhiteboardDocument", () => {
  it("deletedAt을 비우고 복구된 문서를 반환한다", async () => {
    const { tx, updateStub } = mockChangeTransaction({
      documentRows: [{ ...documentRow, ...joinColumns, deletedAt }],
    });

    await expect(restoreWhiteboardDocument(tx as never, documentId)).resolves.toEqual({
      ...documentItem,
      deletedAt: null,
      updatedAt: expect.any(Date),
    });
    expect(updateStub.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: null, updatedAt: expect.any(Date) }),
    );
  });

  it("삭제되지 않은 문서는 400 RESOURCE_NOT_DELETED이며 update를 실행하지 않는다", async () => {
    const { tx } = mockChangeTransaction();

    await expect(restoreWhiteboardDocument(tx as never, documentId)).rejects.toMatchObject({
      status: 400,
      code: "RESOURCE_NOT_DELETED",
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  /*
   * 프로젝트가 삭제된 채로 문서를 복구하면 제품에서는 여전히 보이지 않는다. 그래도 막지
   * 않는다 — 프로젝트를 먼저 복구할지 문서만 되살려 둘지는 어드민이 판단한다. 응답의
   * `project.deletedAt`으로 화면이 안내한다.
   */
  it("프로젝트가 삭제된 문서도 복구하고 프로젝트 삭제 시각을 함께 반환한다", async () => {
    const { tx } = mockChangeTransaction({
      documentRows: [{ ...documentRow, ...joinColumns, deletedAt, projectDeletedAt: deletedAt }],
    });

    await expect(restoreWhiteboardDocument(tx as never, documentId)).resolves.toMatchObject({
      deletedAt: null,
      project: { id: projectId, name: "Launch Plan", deletedAt },
    });
  });

  it("없는 문서는 404이며 update를 실행하지 않는다", async () => {
    const { tx } = mockChangeTransaction({ documentRows: [] });

    await expect(restoreWhiteboardDocument(tx as never, documentId)).rejects.toMatchObject({
      status: 404,
    });
    expect(tx.update).not.toHaveBeenCalled();
  });
});
