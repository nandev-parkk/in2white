import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  deleteProject,
  getProjectDetail,
  listProjects,
  restoreProject,
} from "@/services/admin-project.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/db/client", () => ({ db: { select: vi.fn() } }));

const projectId = "550e8400-e29b-41d4-a716-446655440010";
const workspaceId = "550e8400-e29b-41d4-a716-446655440002";
const creatorId = "550e8400-e29b-41d4-a716-446655440001";
const documentId = "550e8400-e29b-41d4-a716-446655440020";
const createdAt = new Date("2026-09-20T00:00:00.000Z");
const updatedAt = new Date("2026-09-21T00:00:00.000Z");
const deletedAt = new Date("2026-09-22T00:00:00.000Z");

/* 서비스가 join 컬럼을 평평하게 읽고 중첩 객체로 조립하는지 보기 위해 행은 평평하게 둔다. */
const projectRow = {
  id: projectId,
  name: "Launch Plan",
  description: "설명",
  deletedAt: null,
  createdAt,
  updatedAt,
};
const joinColumns = {
  workspaceId,
  workspaceName: "Team Workspace",
  creatorId,
  creatorName: "Kim Owner",
  creatorEmail: "owner@example.com",
};
const workspace = { id: workspaceId, name: "Team Workspace" };
const creator = { id: creatorId, name: "Kim Owner", email: "owner@example.com" };
const projectItem = { ...projectRow, workspace, creator };

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

const LIST_COUNT_CHAIN = ["from", "innerJoin", "innerJoin", "where"];
const LIST_ROWS_CHAIN = [...LIST_COUNT_CHAIN, "orderBy", "limit", "offset"];

describe("listProjects", () => {
  it("워크스페이스·생성자·활성 문서 수와 페이지 정보를 함께 반환한다", async () => {
    const countStub = queryStub(LIST_COUNT_CHAIN, [{ total: 3 }]);
    const rowsStub = queryStub(LIST_ROWS_CHAIN, [
      { ...projectRow, ...joinColumns, whiteboardDocumentCount: "4" },
    ]);
    mockSelects(countStub, rowsStub);

    await expect(listProjects({ status: "all", page: 2, limit: 2 })).resolves.toEqual({
      projects: [{ ...projectItem, whiteboardDocumentCount: 4 }],
      pagination: { page: 2, limit: 2, total: 3, totalPages: 2 },
    });
    expect(rowsStub.limit).toHaveBeenCalledWith(2);
    expect(rowsStub.offset).toHaveBeenCalledWith(2);
  });

  it("status가 all이면 삭제 여부 조건을 걸지 않는다", async () => {
    const countStub = queryStub(LIST_COUNT_CHAIN, [{ total: 0 }]);
    mockSelects(countStub, queryStub(LIST_ROWS_CHAIN, []));

    await listProjects({ status: "all", page: 1, limit: 20 });

    expect(countStub.where).toHaveBeenCalledWith(undefined);
  });

  it.each([
    { status: "active" as const, label: "활성" },
    { status: "deleted" as const, label: "삭제" },
  ])("status가 $status면 $label 조건을 두 쿼리에 같이 적용한다", async ({ status }) => {
    const countStub = queryStub(LIST_COUNT_CHAIN, [{ total: 0 }]);
    const rowsStub = queryStub(LIST_ROWS_CHAIN, []);
    mockSelects(countStub, rowsStub);

    await listProjects({ status, page: 1, limit: 20 });

    const countWhere = vi.mocked(countStub.where as (condition: unknown) => unknown);
    const rowsWhere = vi.mocked(rowsStub.where as (condition: unknown) => unknown);
    expect(countWhere.mock.calls[0]![0]).toBeDefined();
    expect(rowsWhere.mock.calls[0]![0]).toEqual(countWhere.mock.calls[0]![0]);
  });

  it("검색어와 워크스페이스 조건을 함께 적용한다", async () => {
    const countStub = queryStub(LIST_COUNT_CHAIN, [{ total: 0 }]);
    const rowsStub = queryStub(LIST_ROWS_CHAIN, []);
    mockSelects(countStub, rowsStub);

    await listProjects({ workspaceId, search: "Launch", status: "active", page: 1, limit: 20 });

    const countWhere = vi.mocked(countStub.where as (condition: unknown) => unknown);
    const rowsWhere = vi.mocked(rowsStub.where as (condition: unknown) => unknown);
    expect(countWhere.mock.calls[0]![0]).toBeDefined();
    expect(rowsWhere.mock.calls[0]![0]).toEqual(countWhere.mock.calls[0]![0]);
  });
});

describe("getProjectDetail", () => {
  it("프로젝트와 문서 목록을 함께 반환한다", async () => {
    mockSelects(
      queryStub(["from", "innerJoin", "innerJoin", "where"], [{ ...projectRow, ...joinColumns }]),
      queryStub(
        ["from", "innerJoin", "where", "orderBy"],
        [
          {
            id: documentId,
            name: "Sprint Board",
            creatorId,
            creatorName: "Kim Owner",
            deletedAt,
            createdAt,
            updatedAt,
          },
        ],
      ),
    );

    await expect(getProjectDetail(projectId)).resolves.toEqual({
      project: projectItem,
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
    });
  });

  /* 삭제된 프로젝트의 상세는 열려 있어야 한다 — 복구 판단에 필요한 유일한 화면이다. */
  it("삭제된 프로젝트도 상세를 반환한다", async () => {
    mockSelects(
      queryStub(
        ["from", "innerJoin", "innerJoin", "where"],
        [{ ...projectRow, ...joinColumns, deletedAt }],
      ),
      queryStub(["from", "innerJoin", "where", "orderBy"], []),
    );

    await expect(getProjectDetail(projectId)).resolves.toMatchObject({
      project: { deletedAt },
      whiteboardDocuments: [],
    });
  });

  it("없는 프로젝트는 404이며 문서를 조회하지 않는다", async () => {
    mockSelects(queryStub(["from", "innerJoin", "innerJoin", "where"], []));

    await expect(getProjectDetail(projectId)).rejects.toThrow(HttpError);
    expect(db.select).toHaveBeenCalledOnce();
  });
});

function mockChangeTransaction({
  projectRows = [{ ...projectRow, ...joinColumns }] as unknown[],
  updatedRows = [{ id: projectId }] as unknown[],
} = {}) {
  const selectStub = queryStub(["from", "innerJoin", "innerJoin", "where"], projectRows);
  const updateStub = queryStub(["set", "where", "returning"], updatedRows);
  const tx = {
    select: vi.fn().mockReturnValue(selectStub),
    update: vi.fn().mockReturnValue(updateStub),
  };
  return { tx, selectStub, updateStub };
}

describe("deleteProject", () => {
  it("deletedAt을 채우고 변경된 프로젝트를 반환한다", async () => {
    const { tx, updateStub } = mockChangeTransaction();

    await expect(deleteProject(tx as never, projectId)).resolves.toEqual({
      ...projectItem,
      deletedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(updateStub.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: expect.any(Date), updatedAt: expect.any(Date) }),
    );
  });

  it("없는 프로젝트는 404이며 update를 실행하지 않는다", async () => {
    const { tx } = mockChangeTransaction({ projectRows: [] });

    await expect(deleteProject(tx as never, projectId)).rejects.toMatchObject({ status: 404 });
    expect(tx.update).not.toHaveBeenCalled();
  });

  /* 이미 삭제된 프로젝트는 어드민 화면에도 "삭제됨"으로 보인다. 다시 지울 대상이 없다. */
  it("이미 삭제된 프로젝트는 404이며 update를 실행하지 않는다", async () => {
    const { tx } = mockChangeTransaction({
      projectRows: [{ ...projectRow, ...joinColumns, deletedAt }],
    });

    await expect(deleteProject(tx as never, projectId)).rejects.toMatchObject({
      status: 404,
      code: "PROJECT_NOT_FOUND",
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("선행 조회와 update 사이에 사라지면 404다", async () => {
    const { tx } = mockChangeTransaction({ updatedRows: [] });

    await expect(deleteProject(tx as never, projectId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("restoreProject", () => {
  it("deletedAt을 비우고 복구된 프로젝트를 반환한다", async () => {
    const { tx, updateStub } = mockChangeTransaction({
      projectRows: [{ ...projectRow, ...joinColumns, deletedAt }],
    });

    await expect(restoreProject(tx as never, projectId)).resolves.toEqual({
      ...projectItem,
      deletedAt: null,
      updatedAt: expect.any(Date),
    });
    expect(updateStub.set).toHaveBeenCalledWith(
      expect.objectContaining({ deletedAt: null, updatedAt: expect.any(Date) }),
    );
  });

  it("삭제되지 않은 프로젝트는 400 RESOURCE_NOT_DELETED이며 update를 실행하지 않는다", async () => {
    const { tx } = mockChangeTransaction();

    await expect(restoreProject(tx as never, projectId)).rejects.toMatchObject({
      status: 400,
      code: "RESOURCE_NOT_DELETED",
    });
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("없는 프로젝트는 404이며 update를 실행하지 않는다", async () => {
    const { tx } = mockChangeTransaction({ projectRows: [] });

    await expect(restoreProject(tx as never, projectId)).rejects.toMatchObject({ status: 404 });
    expect(tx.update).not.toHaveBeenCalled();
  });
});
