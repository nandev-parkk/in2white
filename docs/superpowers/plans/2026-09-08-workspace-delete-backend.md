# 워크스페이스 삭제 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 워크스페이스 소유자가 본인이 추가로 생성한(기본이 아닌) 워크스페이스를 삭제할 수 있는 백엔드 API를 추가한다.

**Architecture:** `DELETE /workspaces/:workspaceId` 엔드포인트를 기존 워크스페이스 라우터에 추가한다. 서비스는 트랜잭션 안에서 요청자의 멤버십·소유자 권한·기본 워크스페이스 여부를 순서대로 확인한 뒤 `workspaces` 행을 삭제한다. `projects`, `whiteboard_documents`, `workspace_memberships`는 이미 `workspaceId` 외래키에 `onDelete: "cascade"`가 설정되어 있으므로 DB가 자동으로 하위 리소스를 함께 삭제하며, 이번 작업에서는 스키마·마이그레이션 변경이 없다.

**Tech Stack:** Node.js 20+, TypeScript, Express, Drizzle ORM/PostgreSQL, Vitest, Supertest, pnpm.

**Spec:** `PRODUCT.md`의 워크스페이스 삭제 규칙(189-190행, 1160행 등) — Owner만 삭제 가능, 기본 워크스페이스(My Workspace)는 Owner라도 삭제 불가, 삭제 시 하위 프로젝트/화이트보드 문서 함께 삭제.

## Global Constraints

- 모든 사용자 메시지와 문서는 한국어로 작성한다.
- 워크스페이스 삭제는 소유자 전용이며, 기본 워크스페이스(`isDefault: true`)는 소유자 본인이어도 삭제할 수 없다.
- 삭제 성공 응답은 `204 No Content`이며 바디를 반환하지 않는다.
- 기본 워크스페이스 삭제 시도는 권한 문제가 아닌 비즈니스 규칙 위반이므로 `400 WORKSPACE_DEFAULT_DELETE_FORBIDDEN`으로 응답한다 (권한 없음인 `403 WORKSPACE_DELETE_FORBIDDEN`과 구분).
- 하위 리소스(`projects`, `whiteboard_documents`, `workspace_memberships`) cascade 삭제는 기존 FK 제약(`onDelete: "cascade"`)에 위임하며, 이번 작업에서 스키마·마이그레이션을 변경하지 않는다.
- 기존 워크스페이스 생성·조회·수정 구현과 현재 작업 트리의 미커밋 변경 사항을 보존한다.
- 커밋, 푸시, 머지, 실제 데이터베이스 마이그레이션 실행은 사용자가 별도로 요청하기 전까지 수행하지 않는다.
- 각 구현 단계는 테스트 우선으로 진행하고, 구현 후 `pnpm --dir backend test`, `pnpm --dir backend lint`, `pnpm --dir backend build`, `pnpm --dir backend exec prettier --check src tests`로 검증한다.

---

### Task 1: 워크스페이스 삭제 API에 대한 실패 테스트 작성

**Files:**
- Modify: `backend/tests/workspace.test.ts`

**Interfaces:**
- Consumes: 기존 `PATCH /workspaces/:workspaceId` 테스트의 `db.transaction` 목킹 패턴, `createAccessToken()` 헬퍼, `workspaceMemberships`/`workspaces` 스키마 객체
- Produces: Task 2가 만족해야 하는 `DELETE /workspaces/:workspaceId` API 계약

- [ ] **Step 1: `PATCH /workspaces/:workspaceId` describe 블록 뒤에 `DELETE /workspaces/:workspaceId` describe 블록을 열고 트랜잭션 목킹 헬퍼를 추가한다.**

  `backend/tests/workspace.test.ts`의 441번째 줄(`PATCH` describe 블록을 닫는 `});`) 바로 다음에 추가한다. **주의:** 아래 코드는 `describe(...)`를 여는 중괄호만 있고 닫는 `});`는 없다 — Step 2, Step 3에서 그 안에 `it(...)` 블록들을 이어서 추가하고, Step 3 마지막에 가서야 describe 블록을 닫는다.

  ```ts
  describe("DELETE /workspaces/:workspaceId", () => {
    function mockWorkspaceDeleteTransaction({
      membershipRows = [{ role: "owner" as const, isDefault: false }],
      deleteRows = [{ id: "workspace-1" }],
      deleteError,
    }: {
      membershipRows?: Array<{ role: "owner" | "member"; isDefault: boolean }>;
      deleteRows?: unknown[];
      deleteError?: Error;
    } = {}) {
      const membershipQuery = {
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(membershipRows),
      };
      const workspaceDelete = {
        where: vi.fn().mockReturnThis(),
        returning: deleteError
          ? vi.fn().mockRejectedValue(deleteError)
          : vi.fn().mockResolvedValue(deleteRows),
      };
      const transaction = {
        select: vi.fn().mockReturnValue(membershipQuery),
        delete: vi.fn().mockReturnValue(workspaceDelete),
      };

      vi.mocked(db.transaction).mockImplementation(async (callback) =>
        callback(transaction as never),
      );

      return { membershipQuery, transaction, workspaceDelete };
    }
  ```

  (닫는 `});`를 아직 쓰지 않았는지 다시 확인한다 — Step 3에서 닫는다.)

- [ ] **Step 2: 성공 케이스(204, 쿼리 인자 검증)를 `mockWorkspaceDeleteTransaction` 함수 선언 바로 다음, describe 블록 안에 추가한다.**

  ```ts
  it("deletes an owned non-default workspace and returns 204", async () => {
    const { membershipQuery, transaction, workspaceDelete } = mockWorkspaceDeleteTransaction();

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transaction.select).toHaveBeenCalledWith({
      role: workspaceMemberships.role,
      isDefault: workspaces.isDefault,
    });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipQuery.innerJoin).toHaveBeenCalledWith(
      workspaces,
      eq(workspaceMemberships.workspaceId, workspaces.id),
    );
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, "workspace-1"),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );
    expect(transaction.delete).toHaveBeenCalledWith(workspaces);
    expect(workspaceDelete.where).toHaveBeenCalledWith(
      and(eq(workspaces.id, "workspace-1"), eq(workspaces.ownerId, "user-1")),
    );
  });
  ```

- [ ] **Step 3: 인증·권한·존재 여부에 대한 실패 경로 테스트를 작성하고, describe 블록을 닫는다.**

  Step 2에서 추가한 성공 케이스 `it(...)` 바로 다음, 같은 describe 블록 안에 이어서 추가한다. 마지막 `it` 다음에 오는 `});`가 Step 1에서 연 `describe("DELETE /workspaces/:workspaceId", () => {`를 닫는 중괄호다.

  ```ts
  it("returns 401 when the request is not authenticated", async () => {
    const response = await request(createApp()).delete("/workspaces/workspace-1");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is not a workspace member", async () => {
    const { transaction } = mockWorkspaceDeleteTransaction({ membershipRows: [] });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is a workspace member without owner role", async () => {
    const { transaction } = mockWorkspaceDeleteTransaction({
      membershipRows: [{ role: "member", isDefault: false }],
    });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("WORKSPACE_DELETE_FORBIDDEN");
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace is the default workspace", async () => {
    const { transaction } = mockWorkspaceDeleteTransaction({
      membershipRows: [{ role: "owner", isDefault: true }],
    });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("WORKSPACE_DEFAULT_DELETE_FORBIDDEN");
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the workspace delete returns no row", async () => {
    const { workspaceDelete } = mockWorkspaceDeleteTransaction({ deleteRows: [] });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(workspaceDelete.returning).toHaveBeenCalledOnce();
  });

  it("returns 500 when deleting the workspace fails", async () => {
    mockWorkspaceDeleteTransaction({ deleteError: new Error("workspace delete failed") });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
  });
  ```

  마지막 `});`는 `describe("DELETE /workspaces/:workspaceId", ...)`를 닫는 중괄호다. 이 시점에 describe 블록 안에는 헬퍼 함수 1개와 `it` 7개(성공 1개 + 실패 6개)가 있어야 한다.

- [ ] **Step 4: 테스트를 실행해 RED 상태를 확인한다.**

  Run: `pnpm --dir backend test -- tests/workspace.test.ts`

  Expected: `DELETE /workspaces/:workspaceId` 라우트, `deleteWorkspace` 서비스, `WORKSPACE_DELETE_FORBIDDEN`/`WORKSPACE_DEFAULT_DELETE_FORBIDDEN` 메시지가 아직 없기 때문에 새로 추가한 테스트가 모두 실패한다. 기존 생성·목록·수정 테스트는 계속 PASS해야 한다.

- [ ] **Step 5: 커밋하지 않고 테스트 변경을 리뷰받는다.**

  이 저장소의 사용자 규칙에 따라 커밋 단계는 생략한다. 테스트가 실제 응답·권한·기본 워크스페이스 보호·DB 호출 계약을 검증하는지 확인한 뒤 Task 2로 진행한다.

### Task 2: 소유자 전용 삭제 API 구현

**Files:**
- Modify: `backend/src/constants/messages.ts`
- Modify: `backend/src/services/workspace.service.ts`
- Modify: `backend/src/controllers/workspace.controller.ts`
- Modify: `backend/src/routes/workspace.routes.ts`
- Test: `backend/tests/workspace.test.ts`

**Interfaces:**
- Consumes: Task 1의 `DELETE /workspaces/:workspaceId` 테스트 계약
- Produces: `deleteWorkspace({ workspaceId, userId })` 서비스 함수와 `DELETE /workspaces/:workspaceId` API

- [ ] **Step 1: 오류 메시지를 추가한다.**

  `backend/src/constants/messages.ts`의 `ERROR_MESSAGES` 객체에 `WORKSPACE_UPDATE_FORBIDDEN` 다음 줄로 두 항목을 추가한다.

  ```ts
  WORKSPACE_DELETE_FORBIDDEN: "워크스페이스를 삭제할 권한이 없습니다",
  WORKSPACE_DEFAULT_DELETE_FORBIDDEN: "기본 워크스페이스는 삭제할 수 없습니다",
  ```

- [ ] **Step 2: 서비스에 `deleteWorkspace` 함수를 구현한다.**

  `backend/src/services/workspace.service.ts`의 `UpdateWorkspaceInput` 인터페이스와 `updateWorkspace` 함수 사이 혹은 파일 하단에 다음을 추가한다. (`and`, `eq`는 이미 파일 상단에서 import 되어 있다.)

  ```ts
  export interface DeleteWorkspaceInput {
    workspaceId: string;
    userId: string;
  }

  export async function deleteWorkspace({
    workspaceId,
    userId,
  }: DeleteWorkspaceInput): Promise<void> {
    return db.transaction(async (tx) => {
      const [membership] = await tx
        .select({ role: workspaceMemberships.role, isDefault: workspaces.isDefault })
        .from(workspaceMemberships)
        .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
        .where(
          and(
            eq(workspaceMemberships.workspaceId, workspaceId),
            eq(workspaceMemberships.userId, userId),
          ),
        );

      if (!membership) {
        throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
      }

      if (membership.role !== "owner") {
        throw new HttpError(
          403,
          "WORKSPACE_DELETE_FORBIDDEN",
          ERROR_MESSAGES.WORKSPACE_DELETE_FORBIDDEN,
        );
      }

      if (membership.isDefault) {
        throw new HttpError(
          400,
          "WORKSPACE_DEFAULT_DELETE_FORBIDDEN",
          ERROR_MESSAGES.WORKSPACE_DEFAULT_DELETE_FORBIDDEN,
        );
      }

      const [deleted] = await tx
        .delete(workspaces)
        .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, userId)))
        .returning({ id: workspaces.id });

      if (!deleted) {
        throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
      }
    });
  }
  ```

  하위 `projects`, `whiteboard_documents`, `workspace_memberships`는 기존 FK의 `onDelete: "cascade"`에 의해 PostgreSQL이 자동으로 함께 삭제하므로 이 함수에서 별도로 삭제하지 않는다.

- [ ] **Step 3: 컨트롤러에 `deleteWorkspaceHandler`를 추가한다.**

  `backend/src/controllers/workspace.controller.ts` 상단 import를 다음과 같이 확장한다.

  ```ts
  import {
    createWorkspace,
    deleteWorkspace,
    listWorkspaces,
    updateWorkspace,
  } from "@/services/workspace.service";
  ```

  `updateWorkspaceHandler` 함수 다음에 아래 핸들러를 추가한다.

  ```ts
  export async function deleteWorkspaceHandler(req: Request, res: Response) {
    if (!req.user) {
      throw new HttpError(401, "UNAUTHORIZED", ERROR_MESSAGES.MISSING_BEARER_TOKEN);
    }

    await deleteWorkspace({
      workspaceId: req.params.workspaceId,
      userId: req.user.sub,
    });

    res.status(204).send();
  }
  ```

- [ ] **Step 4: 라우터에 `DELETE /:workspaceId`를 연결한다.**

  `backend/src/routes/workspace.routes.ts`의 import를 확장하고 라우트를 추가한다.

  ```ts
  import {
    createWorkspaceHandler,
    deleteWorkspaceHandler,
    listWorkspacesHandler,
    updateWorkspaceHandler,
  } from "@/controllers/workspace.controller";
  ```

  ```ts
  workspaceRouter.delete("/:workspaceId", authenticate, asyncHandler(deleteWorkspaceHandler));
  ```

  기존 POST·GET·PATCH 라우트의 경로와 응답은 유지한다.

- [ ] **Step 5: 집중 테스트로 GREEN을 확인한다.**

  Run: `pnpm --dir backend test -- tests/workspace.test.ts`

  Expected: workspace 테스트 전체 PASS (생성·목록·수정·삭제).

- [ ] **Step 6: 전체 검증을 실행한다.**

  Run: `pnpm --dir backend test`

  Expected: 전체 테스트 PASS.

  Run: `pnpm --dir backend lint`

  Expected: lint 오류 0건.

  Run: `pnpm --dir backend build`

  Expected: TypeScript 빌드 성공.

  Run: `pnpm --dir backend exec prettier --check src tests`

  Expected: 이번 작업으로 수정한 파일에서 포맷 오류 0건 (기존에 존재하던 무관한 파일의 경고는 이번 작업 범위가 아니다).

- [ ] **Step 7: 커밋하지 않고 변경 범위를 최종 확인한다.**

  `git diff --check`와 `git status --short`로 공백 오류 및 의도하지 않은 파일 변경을 확인한다. 기존 미커밋 변경 사항을 되돌리거나 커밋하지 않는다.

## Self-Review Checklist

- Owner가 아닌 멤버의 삭제 시도가 `403 WORKSPACE_DELETE_FORBIDDEN`으로, 비멤버의 시도가 `404 WORKSPACE_NOT_FOUND`로 고정되어 테스트에 반영되어 있는지 확인한다.
- 기본 워크스페이스 삭제 시도가 소유자여도 `400 WORKSPACE_DEFAULT_DELETE_FORBIDDEN`으로 차단되는지 확인한다.
- 삭제 성공 응답이 `204`이며 바디가 없는지 확인한다.
- 하위 리소스(프로젝트, 화이트보드 문서, 멤버십) 삭제를 서비스 코드에서 별도로 구현하지 않고 기존 FK cascade에 위임했는지 확인한다.
- 기존 생성·조회·수정 API의 라우트, 응답 형식을 변경하지 않았는지 확인한다.
- 계획에 커밋을 요구하는 단계가 없고, 현재 작업 트리의 기존 변경 사항을 보존하는지 확인한다.
