import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import {
  addWorkspaceMember,
  deleteWorkspace,
  getWorkspaceDetail,
  listWorkspaces,
  removeWorkspaceMember,
  transferWorkspaceOwner,
  updateWorkspace,
} from "@/services/admin-workspace.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/db/client", () => ({ db: { select: vi.fn() } }));

const workspaceId = "550e8400-e29b-41d4-a716-446655440002";
const ownerId = "550e8400-e29b-41d4-a716-446655440001";
const memberId = "550e8400-e29b-41d4-a716-446655440003";
const projectId = "550e8400-e29b-41d4-a716-446655440010";
const createdAt = new Date("2026-09-20T00:00:00.000Z");
const updatedAt = new Date("2026-09-21T00:00:00.000Z");

const workspaceRow = {
  id: workspaceId,
  name: "Team Workspace",
  isDefault: false,
  createdAt,
  updatedAt,
};
const ownerColumns = {
  ownerId,
  ownerName: "Kim Owner",
  ownerEmail: "owner@example.com",
};
const owner = { id: ownerId, name: "Kim Owner", email: "owner@example.com" };

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

describe("listWorkspaces", () => {
  it("소유자·멤버 수·프로젝트 수와 페이지 정보를 함께 반환한다", async () => {
    const countStub = queryStub(["from", "innerJoin", "where"], [{ total: 5 }]);
    const rowsStub = queryStub(
      ["from", "innerJoin", "where", "orderBy", "limit", "offset"],
      [{ ...workspaceRow, ...ownerColumns, memberCount: "3", projectCount: "2" }],
    );
    mockSelects(countStub, rowsStub);

    await expect(listWorkspaces({ page: 2, limit: 2 })).resolves.toEqual({
      workspaces: [{ ...workspaceRow, owner, memberCount: 3, projectCount: 2 }],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
    expect(rowsStub.limit).toHaveBeenCalledWith(2);
    expect(rowsStub.offset).toHaveBeenCalledWith(2);
  });

  it("검색어가 없으면 where 조건을 비워둔다", async () => {
    const countStub = queryStub(["from", "innerJoin", "where"], [{ total: 0 }]);
    const rowsStub = queryStub(["from", "innerJoin", "where", "orderBy", "limit", "offset"], []);
    mockSelects(countStub, rowsStub);

    await expect(listWorkspaces({ page: 1, limit: 20 })).resolves.toEqual({
      workspaces: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(countStub.where).toHaveBeenCalledWith(undefined);
  });

  it("검색어가 있으면 같은 조건을 두 쿼리에 적용한다", async () => {
    const countStub = queryStub(["from", "innerJoin", "where"], [{ total: 1 }]);
    const rowsStub = queryStub(["from", "innerJoin", "where", "orderBy", "limit", "offset"], []);
    mockSelects(countStub, rowsStub);

    await listWorkspaces({ search: "Team", page: 1, limit: 20 });

    const countWhere = vi.mocked(countStub.where as (condition: unknown) => unknown);
    const rowsWhere = vi.mocked(rowsStub.where as (condition: unknown) => unknown);
    expect(countWhere.mock.calls[0]![0]).toBeDefined();
    expect(rowsWhere.mock.calls[0]![0]).toEqual(countWhere.mock.calls[0]![0]);
  });
});

describe("getWorkspaceDetail", () => {
  it("멤버와 프로젝트 목록을 함께 반환한다", async () => {
    mockSelects(
      queryStub(["from", "innerJoin", "where"], [{ ...workspaceRow, ...ownerColumns }]),
      queryStub(
        ["from", "innerJoin", "where", "orderBy"],
        [
          {
            userId: ownerId,
            name: "Kim Owner",
            email: "owner@example.com",
            deactivatedAt: null,
            role: "owner",
            joinedAt: createdAt,
          },
        ],
      ),
      queryStub(
        ["from", "innerJoin", "where", "orderBy"],
        [
          {
            id: projectId,
            name: "Deleted Project",
            creatorId: ownerId,
            creatorName: "Kim Owner",
            whiteboardDocumentCount: "4",
            deletedAt: updatedAt,
            createdAt,
          },
        ],
      ),
    );

    await expect(getWorkspaceDetail(workspaceId)).resolves.toEqual({
      workspace: { ...workspaceRow, owner },
      members: [
        {
          userId: ownerId,
          name: "Kim Owner",
          email: "owner@example.com",
          deactivatedAt: null,
          role: "owner",
          joinedAt: createdAt,
        },
      ],
      /* 삭제된 프로젝트도 그대로 노출한다 — 어드민은 복구 대상을 봐야 한다. */
      projects: [
        {
          id: projectId,
          name: "Deleted Project",
          creator: { id: ownerId, name: "Kim Owner" },
          whiteboardDocumentCount: 4,
          deletedAt: updatedAt,
          createdAt,
        },
      ],
    });
  });

  it("없는 워크스페이스는 404이며 멤버·프로젝트를 조회하지 않는다", async () => {
    mockSelects(queryStub(["from", "innerJoin", "where"], []));

    await expect(getWorkspaceDetail(workspaceId)).rejects.toMatchObject({
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
    });
    expect(db.select).toHaveBeenCalledOnce();
  });
});

describe("updateWorkspace", () => {
  function mockUpdateTransaction({
    workspaceRows = [workspaceRow] as unknown[],
    updatedRows = [{ ...workspaceRow, name: "바뀐 이름" }] as unknown[],
  } = {}) {
    const selectStub = queryStub(["from", "where"], workspaceRows);
    const updateStub = queryStub(["set", "where", "returning"], updatedRows);
    const tx = {
      select: vi.fn().mockReturnValue(selectStub),
      update: vi.fn().mockReturnValue(updateStub),
    };
    return { tx, selectStub, updateStub };
  }

  it("변경 전후 워크스페이스를 함께 반환한다", async () => {
    const { tx, updateStub } = mockUpdateTransaction();

    await expect(updateWorkspace(tx as never, { workspaceId, name: "바뀐 이름" })).resolves.toEqual(
      {
        previousWorkspace: workspaceRow,
        workspace: { ...workspaceRow, name: "바뀐 이름" },
      },
    );
    expect(updateStub.set).toHaveBeenCalledWith(
      expect.objectContaining({ name: "바뀐 이름", updatedAt: expect.any(Date) }),
    );
  });

  it("없는 워크스페이스는 404이며 update를 실행하지 않는다", async () => {
    const { tx } = mockUpdateTransaction({ workspaceRows: [] });

    await expect(updateWorkspace(tx as never, { workspaceId, name: "바뀐 이름" })).rejects.toThrow(
      HttpError,
    );
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("기본 워크스페이스는 403이며 update를 실행하지 않는다", async () => {
    const { tx } = mockUpdateTransaction({
      workspaceRows: [{ ...workspaceRow, isDefault: true }],
    });

    await expect(
      updateWorkspace(tx as never, { workspaceId, name: "바뀐 이름" }),
    ).rejects.toMatchObject({ status: 403, code: "WORKSPACE_DEFAULT_UPDATE_FORBIDDEN" });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe("transferWorkspaceOwner", () => {
  function mockTransferTransaction({
    workspaceRows = [{ ...workspaceRow, ...ownerColumns }] as unknown[],
    membershipRows = [
      { id: "membership-1", name: "Lee Member", email: "member@example.com" },
    ] as unknown[],
    updatedRows = [workspaceRow] as unknown[],
  } = {}) {
    const workspaceStub = queryStub(["from", "innerJoin", "where"], workspaceRows);
    const membershipStub = queryStub(["from", "innerJoin", "where"], membershipRows);
    const demoteStub = queryStub(["set", "where"], []);
    const promoteStub = queryStub(["set", "where"], []);
    const workspaceUpdateStub = queryStub(["set", "where", "returning"], updatedRows);
    const tx = {
      select: vi.fn().mockReturnValueOnce(workspaceStub).mockReturnValueOnce(membershipStub),
      update: vi
        .fn()
        .mockReturnValueOnce(demoteStub)
        .mockReturnValueOnce(promoteStub)
        .mockReturnValueOnce(workspaceUpdateStub),
    };
    return { tx, demoteStub, promoteStub, workspaceUpdateStub };
  }

  it("이전 소유자를 강등하고 대상을 소유자로 올린다", async () => {
    const { tx, demoteStub, promoteStub, workspaceUpdateStub } = mockTransferTransaction();

    await expect(
      transferWorkspaceOwner(tx as never, { workspaceId, userId: memberId }),
    ).resolves.toEqual({
      workspace: workspaceRow,
      previousOwner: owner,
      newOwner: { id: memberId, name: "Lee Member", email: "member@example.com" },
    });
    expect(demoteStub.set).toHaveBeenCalledWith({ role: "member" });
    expect(promoteStub.set).toHaveBeenCalledWith({ role: "owner" });
    expect(workspaceUpdateStub.set).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: memberId }),
    );
  });

  it("없는 워크스페이스는 404이며 멤버십을 바꾸지 않는다", async () => {
    const { tx } = mockTransferTransaction({ workspaceRows: [] });

    await expect(
      transferWorkspaceOwner(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 404, code: "WORKSPACE_NOT_FOUND" });
    expect(tx.update).not.toHaveBeenCalled();
  });

  /* 비멤버에게 소유권을 넘기면 멤버 목록에 없는 소유자가 생겨 제품 권한 검사가 전부 막힌다. */
  it("대상이 멤버가 아니면 400이며 멤버십을 바꾸지 않는다", async () => {
    const { tx } = mockTransferTransaction({ membershipRows: [] });

    await expect(
      transferWorkspaceOwner(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 400, code: "TRANSFER_TARGET_NOT_MEMBER" });
    expect(tx.update).not.toHaveBeenCalled();
  });
});

describe("addWorkspaceMember", () => {
  function mockAddTransaction({
    workspaceRows = [workspaceRow] as unknown[],
    userRows = [
      { id: memberId, name: "Lee Member", email: "member@example.com", deactivatedAt: null },
    ] as unknown[],
    existingRows = [] as unknown[],
    insertedRows = [{ role: "member", joinedAt: createdAt }] as unknown[],
  } = {}) {
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(queryStub(["from", "where"], workspaceRows))
        .mockReturnValueOnce(queryStub(["from", "where"], userRows))
        .mockReturnValueOnce(queryStub(["from", "where"], existingRows)),
      insert: vi
        .fn()
        .mockReturnValue(queryStub(["values", "onConflictDoNothing", "returning"], insertedRows)),
    };
    return { tx };
  }

  it("멤버로 추가하고 워크스페이스와 멤버 정보를 함께 반환한다", async () => {
    const { tx } = mockAddTransaction();

    await expect(
      addWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).resolves.toEqual({
      workspace: workspaceRow,
      member: {
        userId: memberId,
        name: "Lee Member",
        email: "member@example.com",
        deactivatedAt: null,
        role: "member",
        joinedAt: createdAt,
      },
    });
  });

  it("없는 워크스페이스는 404이며 insert를 실행하지 않는다", async () => {
    const { tx } = mockAddTransaction({ workspaceRows: [] });

    await expect(
      addWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 404, code: "WORKSPACE_NOT_FOUND" });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("기본 워크스페이스는 403이며 insert를 실행하지 않는다", async () => {
    const { tx } = mockAddTransaction({ workspaceRows: [{ ...workspaceRow, isDefault: true }] });

    await expect(
      addWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 403, code: "MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN" });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("없는 사용자는 404이며 insert를 실행하지 않는다", async () => {
    const { tx } = mockAddTransaction({ userRows: [] });

    await expect(
      addWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 404, code: "USER_NOT_FOUND" });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("이미 멤버면 409이며 insert를 실행하지 않는다", async () => {
    const { tx } = mockAddTransaction({ existingRows: [{ id: "membership-1" }] });

    await expect(
      addWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 409, code: "MEMBER_ALREADY_EXISTS" });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  /* 사전 조회와 insert 사이의 경합. 제약이 막아준 결과도 중복이다. */
  it("insert가 아무 행도 돌려주지 않으면 409로 변환한다", async () => {
    const { tx } = mockAddTransaction({ insertedRows: [] });

    await expect(
      addWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 409, code: "MEMBER_ALREADY_EXISTS" });
  });
});

describe("removeWorkspaceMember", () => {
  function mockRemoveTransaction({
    workspaceRows = [workspaceRow] as unknown[],
    membershipRows = [
      {
        userId: memberId,
        name: "Lee Member",
        email: "member@example.com",
        deactivatedAt: null,
        role: "member",
        joinedAt: createdAt,
      },
    ] as unknown[],
  } = {}) {
    const deleteStub = queryStub(["where"], []);
    const tx = {
      select: vi
        .fn()
        .mockReturnValueOnce(queryStub(["from", "where"], workspaceRows))
        .mockReturnValueOnce(queryStub(["from", "innerJoin", "where"], membershipRows)),
      delete: vi.fn().mockReturnValue(deleteStub),
    };
    return { tx, deleteStub };
  }

  it("멤버십을 지우고 워크스페이스와 멤버 정보를 함께 반환한다", async () => {
    const { tx } = mockRemoveTransaction();

    await expect(
      removeWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).resolves.toEqual({
      workspace: workspaceRow,
      member: {
        userId: memberId,
        name: "Lee Member",
        email: "member@example.com",
        deactivatedAt: null,
        role: "member",
        joinedAt: createdAt,
      },
    });
    expect(tx.delete).toHaveBeenCalledOnce();
  });

  it("없는 워크스페이스는 404이며 delete를 실행하지 않는다", async () => {
    const { tx } = mockRemoveTransaction({ workspaceRows: [] });

    await expect(
      removeWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 404, code: "WORKSPACE_NOT_FOUND" });
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("멤버가 아니면 404이며 delete를 실행하지 않는다", async () => {
    const { tx } = mockRemoveTransaction({ membershipRows: [] });

    await expect(
      removeWorkspaceMember(tx as never, { workspaceId, userId: memberId }),
    ).rejects.toMatchObject({ status: 404, code: "MEMBER_NOT_FOUND" });
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("소유자 제거는 403이며 delete를 실행하지 않는다", async () => {
    const { tx } = mockRemoveTransaction({
      membershipRows: [
        {
          userId: ownerId,
          name: "Kim Owner",
          email: "owner@example.com",
          deactivatedAt: null,
          role: "owner",
          joinedAt: createdAt,
        },
      ],
    });

    await expect(
      removeWorkspaceMember(tx as never, { workspaceId, userId: ownerId }),
    ).rejects.toMatchObject({ status: 403, code: "MEMBER_OWNER_REMOVE_FORBIDDEN" });
    expect(tx.delete).not.toHaveBeenCalled();
  });
});

describe("deleteWorkspace", () => {
  function mockDeleteTransaction({
    workspaceRows = [{ ...workspaceRow, ...ownerColumns }] as unknown[],
  } = {}) {
    const tx = {
      select: vi.fn().mockReturnValue(queryStub(["from", "innerJoin", "where"], workspaceRows)),
      delete: vi.fn().mockReturnValue(queryStub(["where"], [])),
    };
    return { tx };
  }

  it("삭제한 워크스페이스와 소유자를 감사 로그용으로 돌려준다", async () => {
    const { tx } = mockDeleteTransaction();

    await expect(deleteWorkspace(tx as never, workspaceId)).resolves.toEqual({
      ...workspaceRow,
      owner,
    });
    expect(tx.delete).toHaveBeenCalledOnce();
  });

  it("없는 워크스페이스는 404이며 delete를 실행하지 않는다", async () => {
    const { tx } = mockDeleteTransaction({ workspaceRows: [] });

    await expect(deleteWorkspace(tx as never, workspaceId)).rejects.toMatchObject({
      status: 404,
      code: "WORKSPACE_NOT_FOUND",
    });
    expect(tx.delete).not.toHaveBeenCalled();
  });

  it("기본 워크스페이스는 403이며 delete를 실행하지 않는다", async () => {
    const { tx } = mockDeleteTransaction({
      workspaceRows: [{ ...workspaceRow, ...ownerColumns, isDefault: true }],
    });

    await expect(deleteWorkspace(tx as never, workspaceId)).rejects.toMatchObject({
      status: 403,
      code: "WORKSPACE_DEFAULT_DELETE_FORBIDDEN",
    });
    expect(tx.delete).not.toHaveBeenCalled();
  });
});
