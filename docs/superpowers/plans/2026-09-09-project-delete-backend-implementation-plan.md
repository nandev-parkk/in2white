# 프로젝트 삭제 백엔드 구현 계획

> **에이전트 작업자용:** 이 계획을 실행할 때는 superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans를 사용한다. 단계는 체크박스(`- [ ]`)로 추적하며, 각 구현 단계는 테스트 우선으로 진행한다.

**Status:** 구현 완료 · 최종 리뷰 finding 수정 완료

**Goal:** 인증된 워크스페이스 Owner 또는 프로젝트 Creator가 프로젝트를 소프트 삭제할 수 있는 DELETE /workspaces/:workspaceId/projects/:projectId API와 활성 프로젝트 필터를 추가하고, 워크스페이스 상세 프로젝트 집계도 활성 프로젝트만 대상으로 유지한다.

**Architecture:** 기존 routes → controllers → services → db/schema 계층을 유지한다. projects.deletedAt nullable timestamp로 삭제 상태를 저장하고, 서비스 트랜잭션에서 멤버십·프로젝트·권한을 검증한 뒤 deletedAt과 updatedAt을 갱신한다. 목록·수정과 워크스페이스 상세 프로젝트 집계는 deletedAt IS NULL 조건으로 활성 프로젝트만 대상으로 한다.

**Tech Stack:** Node.js 20+, TypeScript, Express, Drizzle ORM/PostgreSQL, Zod, Vitest, Supertest, pnpm.

**Spec:** docs/superpowers/specs/2026-09-09-project-delete-backend-design.md

## Global Constraints

- 모든 문서와 사용자-facing 오류 메시지는 한국어로 작성한다.
- 작업 범위는 백엔드 API와 DB schema/migration으로 한정한다.
- 삭제는 deletedAt timestamp를 기록하는 소프트 삭제다.
- 복구 API·UI, 프론트엔드 삭제 UI, 영구 삭제 정리 작업은 추가하지 않는다.
- 삭제 성공 응답은 204 No Content다.
- 삭제 권한은 워크스페이스 Owner 또는 프로젝트 Creator다.
- 비멤버는 404 WORKSPACE_NOT_FOUND, 권한 없는 Member는 403 PROJECT_DELETE_FORBIDDEN, 대상 없음·이미 삭제됨은 404 PROJECT_NOT_FOUND다.
- 프로젝트 목록·수정과 워크스페이스 상세 프로젝트 집계는 활성 프로젝트(deletedAt IS NULL)만 대상으로 한다.
- 하위 화이트보드 문서는 물리 삭제하지 않는다.
- 실제 DB에 migration을 적용하지 않는다. migration 파일 생성과 코드 검증까지만 수행한다.
- 사용자가 요청하기 전에는 Git commit, push, merge, PR을 실행하지 않는다.
- 기존 변경사항을 되돌리거나 덮어쓰지 않는다.

---

## 파일 구조 및 책임

- Modify: backend/src/db/schema/projects.ts
  - deletedAt nullable timestamp 컬럼을 선언한다.
- Create: Drizzle이 생성하는 backend/src/db/migrations/0002_*.sql 및 관련 meta 파일
  - projects.deleted_at 컬럼 추가 migration을 기록한다.
- Modify: backend/src/constants/messages.ts
  - PROJECT_DELETE_FORBIDDEN 메시지를 추가한다.
- Modify: backend/src/services/project.service.ts
  - 활성 프로젝트 필터를 목록·수정에 반영하고 deleteProject 유스케이스를 추가한다.
- Modify: backend/src/services/workspace.service.ts
  - 워크스페이스 상세 project count에서 삭제 프로젝트를 제외한다.
- Modify: backend/src/controllers/project.controller.ts
  - DELETE handler에서 인증·path 검증·204 응답을 담당한다.
- Modify: backend/src/routes/project.routes.ts
  - DELETE 라우트를 인증 middleware와 연결한다.
- Modify: backend/tests/db-schema.test.ts
  - projects.deletedAt 컬럼 export를 검증한다.
- Modify: backend/tests/project.test.ts
  - DELETE API 계약과 목록·수정의 활성 프로젝트 조건을 검증한다.
- Modify: backend/tests/workspace.test.ts
  - 워크스페이스 상세 project count query의 활성 프로젝트 조건을 검증한다.
- Remove from Git index: .superpowers/sdd/2026-09-09-project-delete-backend-implementation-plan/task-1-report.md
  - 로컬 SDD artifact는 보존하고 PR 변경 범위에서는 제외한다.
- Modify: 이 문서
  - 구현 종료 후 Implementation Results를 추가해 실제 변경·검증·차이·후속 작업을 기록한다.

---

### Task 1: 프로젝트 삭제 상태 컬럼과 migration 추가

**Files:**
- Modify: backend/tests/db-schema.test.ts
- Modify: backend/src/db/schema/projects.ts
- Create: backend/src/db/migrations/0002_*.sql
- Modify: backend/src/db/migrations/meta/_journal.json
- Create or modify: backend/src/db/migrations/meta/0002_snapshot.json

**Interfaces:**
- Consumes: 기존 projects Drizzle table과 db-schema.test.ts의 schema export 검사
- Produces: projects.deletedAt 타입과 projects.deleted_at database column

- [x] **Step 1: deletedAt 컬럼을 요구하는 실패 테스트를 추가한다.**

backend/tests/db-schema.test.ts의 기존 schema describe 안에 다음 테스트를 추가한다.

~~~ts
it("projects schema exposes a nullable deletedAt column", () => {
  expect(schema.projects.deletedAt).toBeDefined();
});
~~~

- [x] **Step 2: 스키마 테스트가 새 컬럼 부재로 실패하는지 확인한다.**

Run: pnpm --dir backend test -- tests/db-schema.test.ts

Expected: projects.deletedAt가 아직 정의되지 않아 실패한다.

- [x] **Step 3: Drizzle schema에 nullable deletedAt을 추가한다.**

backend/src/db/schema/projects.ts의 updatedAt 뒤에 다음 컬럼을 추가한다.

~~~ts
deletedAt: timestamp("deleted_at", { withTimezone: true }),
~~~

default와 notNull()은 사용하지 않는다. 기존 행과 새 프로젝트의 값이 NULL이면 활성 상태라는 계약을 유지한다.

- [x] **Step 4: 스키마 테스트가 통과하는지 확인한다.**

Run: pnpm --dir backend test -- tests/db-schema.test.ts

Expected: schema 테스트 전체 PASS.

- [x] **Step 5: Drizzle migration을 생성한다.**

Run: pnpm --dir backend db:generate

Expected: 새 0002_*.sql migration과 backend/src/db/migrations/meta snapshot/journal 변경이 생성되고, SQL에 다음 의미의 nullable column 추가가 포함된다.

~~~sql
ALTER TABLE "projects" ADD COLUMN "deleted_at" timestamp with time zone;
~~~

pnpm --dir backend db:migrate는 실행하지 않는다.

- [x] **Step 6: migration diff가 파괴적 변경 없이 생성됐는지 확인한다.**

Run: git diff --check

Expected: whitespace 오류가 없고, projects 테이블의 nullable column 추가 외에 unrelated schema 변경이 없다.

---

### Task 2: 프로젝트 DELETE API의 실패 테스트 작성

**Files:**
- Modify: backend/tests/project.test.ts

**Interfaces:**
- Consumes: createApp(), signAccessToken(), db.transaction mock, projects, workspaceMemberships, projectUpdateParamsSchema
- Produces: 삭제 service와 HTTP route가 만족해야 하는 API·DB 호출 계약

- [x] **Step 1: DELETE용 transaction mock helper를 추가한다.**

기존 mockProjectUpdateTransaction과 같은 mock 패턴으로 다음 helper를 backend/tests/project.test.ts 공통 helper 영역에 추가한다.

~~~ts
function mockProjectDeleteTransaction({
  membershipRows = [{ role: "owner" }],
  projectRows = [{ id: createdProject.id, creatorId: "user-2" }],
  deletedProjectRows = [{ id: createdProject.id }],
  membershipError,
  projectError,
  deleteError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  deletedProjectRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  deleteError?: Error;
} = {}) {
  const membershipQuery = {
    from: vi.fn().mockReturnThis(),
    where: membershipError
      ? vi.fn().mockRejectedValue(membershipError)
      : vi.fn().mockResolvedValue(membershipRows),
  };
  const projectQuery = {
    from: vi.fn().mockReturnThis(),
    where: projectError
      ? vi.fn().mockRejectedValue(projectError)
      : vi.fn().mockResolvedValue(projectRows),
  };
  const projectDelete = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: deleteError
      ? vi.fn().mockRejectedValue(deleteError)
      : vi.fn().mockResolvedValue(deletedProjectRows),
  };
  const transaction = {
    select: vi.fn().mockReturnValueOnce(membershipQuery).mockReturnValueOnce(projectQuery),
    update: vi.fn().mockReturnValue(projectDelete),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectQuery, projectDelete, transaction };
}
~~~

- [x] **Step 2: 성공·권한·입력·존재 여부 테스트를 추가한다.**

backend/tests/project.test.ts 끝에 다음 DELETE describe를 추가한다. 현재 route/service가 없으므로 테스트는 먼저 실패해야 한다.

~~~ts
describe("DELETE /workspaces/:workspaceId/projects/:projectId", () => {
  it("allows an owner to delete another creator's project and returns 204", async () => {
    const { projectQuery, projectDelete } = mockProjectDeleteTransaction();

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(projectQuery.where).toHaveBeenCalledWith(
      and(
        eq(projects.id, createdProject.id),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
      ),
    );
    expect(projectDelete.set).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(projectDelete.where).toHaveBeenCalledWith(
      and(
        eq(projects.id, createdProject.id),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
      ),
    );
  });

  it("allows the project creator member to delete the project", async () => {
    const { projectDelete } = mockProjectDeleteTransaction({
      membershipRows: [{ role: "member" }],
      projectRows: [{ id: createdProject.id, creatorId: "user-1" }],
    });

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(204);
    expect(projectDelete.set).toHaveBeenCalledOnce();
  });

  it("returns 404 for a non-member before looking up the project", async () => {
    const { projectQuery, projectDelete } = mockProjectDeleteTransaction({ membershipRows: [] });

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(projectQuery.where).not.toHaveBeenCalled();
    expect(projectDelete.set).not.toHaveBeenCalled();
  });

  it("returns 403 for a member who did not create the project", async () => {
    const { projectDelete } = mockProjectDeleteTransaction({
      membershipRows: [{ role: "member" }],
    });

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PROJECT_DELETE_FORBIDDEN");
    expect(projectDelete.set).not.toHaveBeenCalled();
  });

  it.each([
    { label: "workspace id", path: "not-a-uuid/projects/" + createdProject.id },
    { label: "project id", path: workspaceId + "/projects/not-a-uuid" },
  ])("returns 400 for an invalid $label", async ({ path }) => {
    const response = await request(createApp())
      .delete("/workspaces/" + path)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the active project is missing or already deleted", async () => {
    const { projectDelete } = mockProjectDeleteTransaction({ projectRows: [] });

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(projectDelete.set).not.toHaveBeenCalled();
  });

  it("returns 401 without authentication", async () => {
    const response = await request(createApp()).delete(
      "/workspaces/" + workspaceId + "/projects/" + createdProject.id,
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
~~~

이 테스트 코드에는 isNull import도 추가한다.

~~~ts
import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
~~~

- [x] **Step 3: DB 오류 테스트를 추가한다.**

같은 DELETE describe 안에 다음 테스트를 추가한다. membership query, project query, soft-delete update가 각각 500 INTERNAL_SERVER_ERROR가 되고 뒤 단계가 호출되지 않는지 검증한다.

~~~ts
it.each([
  { label: "membership", options: { membershipError: new Error("membership failed") } },
  { label: "project", options: { projectError: new Error("project failed") } },
  { label: "delete", options: { deleteError: new Error("delete failed") } },
])("returns 500 when the $label query fails", async ({ options }) => {
  const { projectQuery, projectDelete } = mockProjectDeleteTransaction(options);

  const response = await request(createApp())
    .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
    .set("Authorization", "Bearer " + (await createAccessToken()));

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");

  if (options.membershipError) {
    expect(projectQuery.where).not.toHaveBeenCalled();
    expect(projectDelete.set).not.toHaveBeenCalled();
  }
  if (options.projectError) {
    expect(projectDelete.set).not.toHaveBeenCalled();
  }
});
~~~

- [x] **Step 4: 삭제 테스트만 실행해 RED를 확인한다.**

Run: pnpm --dir backend test -- tests/project.test.ts

Expected: 기존 프로젝트 테스트는 통과하고 새 DELETE 테스트는 route가 아직 연결되지 않아 실패한다.

---

### Task 3: DELETE API와 삭제 권한 service 구현

**Files:**
- Modify: backend/src/constants/messages.ts
- Modify: backend/src/services/project.service.ts
- Modify: backend/src/controllers/project.controller.ts
- Modify: backend/src/routes/project.routes.ts
- Test: backend/tests/project.test.ts

**Interfaces:**
- Consumes: Task 1의 projects.deletedAt, Task 2의 HTTP·DB 호출 테스트
- Produces: deleteProject(input: DeleteProjectInput): Promise<void>, DELETE /workspaces/:workspaceId/projects/:projectId

- [x] **Step 1: 삭제 권한 오류 메시지를 추가한다.**

backend/src/constants/messages.ts에 기존 PROJECT_UPDATE_FORBIDDEN 다음 항목을 추가한다.

~~~ts
PROJECT_DELETE_FORBIDDEN: "프로젝트를 삭제할 권한이 없습니다",
~~~

- [x] **Step 2: service import와 삭제 입력 타입을 추가한다.**

backend/src/services/project.service.ts의 import를 다음 의미로 확장한다.

~~~ts
import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
~~~

UpdateProjectInput 뒤에 다음 타입을 추가한다.

~~~ts
export interface DeleteProjectInput {
  workspaceId: string;
  projectId: string;
  userId: string;
}
~~~

- [x] **Step 3: deleteProject transaction을 구현한다.**

updateProject 함수 뒤에 다음 로직을 추가한다.

~~~ts
export async function deleteProject({
  workspaceId,
  projectId,
  userId,
}: DeleteProjectInput): Promise<void> {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: workspaceMemberships.role })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, userId),
        ),
      );

    if (!membership) {
      throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }

    const [project] = await tx
      .select({ id: projects.id, creatorId: projects.creatorId })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.workspaceId, workspaceId),
          isNull(projects.deletedAt),
        ),
      );

    if (!project) {
      throw new HttpError(404, "PROJECT_NOT_FOUND", ERROR_MESSAGES.PROJECT_NOT_FOUND);
    }

    if (membership.role !== "owner" && project.creatorId !== userId) {
      throw new HttpError(
        403,
        "PROJECT_DELETE_FORBIDDEN",
        ERROR_MESSAGES.PROJECT_DELETE_FORBIDDEN,
      );
    }

    const now = new Date();
    const [deletedProject] = await tx
      .update(projects)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.workspaceId, workspaceId),
          isNull(projects.deletedAt),
        ),
      )
      .returning({ id: projects.id });

    if (!deletedProject) {
      throw new HttpError(404, "PROJECT_NOT_FOUND", ERROR_MESSAGES.PROJECT_NOT_FOUND);
    }
  });
}
~~~

같은 now 값을 deletedAt과 updatedAt에 사용해 한 삭제 동작의 시각을 일관되게 기록한다. update 결과가 없으면 동시 삭제 또는 이미 삭제된 상태로 보고 404를 반환한다.

- [x] **Step 4: controller에 DELETE handler를 추가한다.**

service import에 deleteProject를 추가하고, updateProjectHandler 뒤에 다음 handler를 추가한다.

~~~ts
export async function deleteProjectHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId } = parseOrThrow(projectUpdateParamsSchema, req.params);

  await deleteProject({
    workspaceId,
    projectId,
    userId: user.sub,
  });

  res.status(204).send();
}
~~~

- [x] **Step 5: project router에 인증 DELETE route를 연결한다.**

backend/src/routes/project.routes.ts에 handler import와 다음 route를 추가한다.

~~~ts
projectRouter.delete("/:projectId", authenticate, asyncHandler(deleteProjectHandler));
~~~

- [x] **Step 6: DELETE API 테스트를 GREEN으로 만든다.**

Run: pnpm --dir backend test -- tests/project.test.ts

Expected: Task 2의 DELETE 성공·권한·입력·존재 여부·DB 오류 테스트를 포함한 프로젝트 테스트 전체 PASS.

---

### Task 4: 목록·수정에서 삭제된 프로젝트 제외

**Files:**
- Modify: backend/tests/project.test.ts
- Modify: backend/src/services/project.service.ts

**Interfaces:**
- Consumes: Task 1의 projects.deletedAt, Task 3의 삭제 상태 계약
- Produces: 목록 pagination과 수정 query가 활성 프로젝트만 대상으로 하는 동작

- [x] **Step 1: 목록 query의 활성 조건을 검증하는 실패 assertion을 추가한다.**

기존 GET 목록 테스트의 countQuery.where와 projectQuery.where 기대값을 다음 형태로 확장한다.

~~~ts
expect(countQuery.where).toHaveBeenCalledWith(
  and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)),
);
expect(projectQuery.where).toHaveBeenCalledWith(
  and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)),
);
~~~

검색 테스트는 활성 조건과 검색 조건이 함께 포함되도록 다음 기대값으로 수정한다.

~~~ts
expect(countQuery.where).toHaveBeenCalledWith(
  and(
    eq(projects.workspaceId, workspaceId),
    isNull(projects.deletedAt),
    ilike(projects.name, "%100\\%\\_done\\\\now%"),
  ),
);
expect(projectQuery.where).toHaveBeenCalledWith(
  and(
    eq(projects.workspaceId, workspaceId),
    isNull(projects.deletedAt),
    ilike(projects.name, "%100\\%\\_done\\\\now%"),
  ),
);
~~~

- [x] **Step 2: 수정 query의 활성 조건을 검증하는 실패 assertion을 추가한다.**

기존 PATCH 성공 테스트에서 projectQuery.where와 projectUpdate.where 기대값을 다음 조건으로 확장한다.

~~~ts
const activeProjectCondition = and(
  eq(projects.id, createdProject.id),
  eq(projects.workspaceId, workspaceId),
  isNull(projects.deletedAt),
);

expect(projectQuery.where).toHaveBeenCalledWith(activeProjectCondition);
expect(projectUpdate.where).toHaveBeenCalledWith(activeProjectCondition);
~~~

프로젝트 조회 mock이 빈 배열을 반환하는 기존 테스트는 삭제된 프로젝트도 동일하게 404 PROJECT_NOT_FOUND가 되는 계약을 이미 검증하므로 유지한다.

- [x] **Step 3: 목록·수정 테스트를 실행해 RED를 확인한다.**

Run: pnpm --dir backend test -- tests/project.test.ts

Expected: DELETE 테스트는 통과하지만 isNull(projects.deletedAt)가 아직 목록·수정 query에 없어서 관련 assertion이 실패한다.

- [x] **Step 4: listProjects의 count와 rows 조건에 isNull을 추가한다.**

backend/src/services/project.service.ts의 whereCondition을 다음 형태로 변경한다.

~~~ts
const whereCondition = and(
  eq(projects.workspaceId, workspaceId),
  isNull(projects.deletedAt),
  search ? ilike(projects.name, buildContainsSearchPattern(search)) : undefined,
);
~~~

count query와 project rows query가 같은 whereCondition을 계속 공유하게 하여 total과 rows가 같은 활성 집합을 사용하도록 한다.

- [x] **Step 5: updateProject 조회와 update 조건에 isNull을 추가한다.**

프로젝트 조회와 update의 where 조건에 다음 세 조건을 모두 사용한다.

~~~ts
and(
  eq(projects.id, projectId),
  eq(projects.workspaceId, workspaceId),
  isNull(projects.deletedAt),
)
~~~

이를 통해 삭제된 프로젝트는 권한 확인 단계에서부터 PROJECT_NOT_FOUND가 되고, 직접 update되지 않는다.

- [x] **Step 6: 프로젝트 회귀 테스트를 GREEN으로 확인한다.**

Run: pnpm --dir backend test -- tests/project.test.ts

Expected: 생성·목록·수정·삭제 프로젝트 테스트 전체 PASS.

---

### Task 5: 전체 검증과 구현 결과 기록

**Files:**
- Modify: docs/superpowers/plans/2026-09-09-project-delete-backend-implementation-plan.md

**Interfaces:**
- Consumes: Task 1~4의 schema, migration, service, controller, route, message, test 결과
- Produces: 검증 결과와 실제 계획 대비 변경 사항이 기록된 구현 계획 문서

- [x] **Step 1: 집중 테스트를 실행한다.**

Run: pnpm --dir backend test -- tests/project.test.ts tests/db-schema.test.ts

Expected: 프로젝트 API와 DB schema 테스트 전체 PASS.

- [x] **Step 2: 전체 테스트를 실행한다.**

Run: pnpm --dir backend test

Expected: 전체 테스트 파일과 테스트 케이스 PASS.

- [x] **Step 3: lint와 build를 실행한다.**

Run: pnpm --dir backend lint

Expected: ESLint 오류 0건.

Run: pnpm --dir backend build

Expected: TypeScript compile과 tsc-alias 처리 성공.

- [x] **Step 4: 포맷과 diff 검사를 실행한다.**

Run: pnpm --dir backend exec prettier --check src tests

Expected: 변경 파일의 source/test 포맷 검사는 PASS한다. repository-wide 검사에서 발견된 기존 baseline 2개 파일의 경고는 Implementation Results에 예외로 기록한다.

Run: git diff --check

Expected: whitespace 오류 0건.

Run: git status --short

Expected: 이번 작업의 설계·계획·schema·migration·service·controller·route·message·test 파일만 변경 목록에 있다. 기존 사용자 변경사항은 보존한다.

- [x] **Step 5: 계획 문서에 실제 Implementation Results를 기록한다.**

구현 파일, 계획과의 차이, 명령별 검증 결과와 실패 원인, 남은 후속 작업은 아래 결과 섹션에 기록했다. 실제 migration은 적용하지 않았다.

---

### Task 6: 최종 리뷰 finding 수정 (완료)

**Files:**
- Modify: backend/tests/workspace.test.ts
- Modify: backend/src/services/workspace.service.ts
- Modify: docs/superpowers/specs/2026-09-09-project-delete-backend-design.md
- Modify: docs/superpowers/plans/2026-09-09-project-delete-backend-implementation-plan.md
- Remove from Git index: .superpowers/sdd/2026-09-09-project-delete-backend-implementation-plan/task-1-report.md

- [x] **Step 1: 워크스페이스 상세 집계 회귀 테스트를 먼저 보강하고 RED를 확인했다.**

`backend/tests/workspace.test.ts`의 상세 성공 테스트 이름에 삭제 프로젝트 제외 계약을 드러내고, project count query가 `and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt))`를 사용하도록 기대값을 변경했다. 기존 구현에서 `pnpm --dir backend test -- tests/workspace.test.ts --silent`를 실행해 Test Files 1 failed, Tests 1 failed | 29 passed, exit 1을 확인했다. 실패 원인은 기존 쿼리가 workspace 조건만 전달한 것이었다.

- [x] **Step 2: 최소 구현으로 GREEN을 확인했다.**

`backend/src/services/workspace.service.ts`에 `isNull` import를 추가하고 project count query에 활성 프로젝트 조건을 적용했다. 동일 workspace 테스트를 재실행해 Test Files 1 passed, Tests 30 passed, exit 0을 확인했다.

- [x] **Step 3: 설계·계획 문서와 SDD artifact 추적 상태를 정리했다.**

설계와 계획에 워크스페이스 상세 집계 계약, 변경 파일, 테스트 전략, 완료 기준과 실제 결과를 반영했다. `task-1-report.md`는 `git rm --cached`로 Git index에서만 제거해 로컬 파일은 보존하고 PR 범위에서는 제외했다.

- [x] **Step 4: 지정된 최종 검증을 완료했다.**

집중 테스트 93개와 전체 테스트 173개, lint, build, 변경 source/test Prettier, `git diff --check`가 통과했다. 전체 `src tests` Prettier는 기존 baseline의 2개 파일에서만 동일하게 실패했다.

## 완료 기준

- DELETE /workspaces/:workspaceId/projects/:projectId가 Owner와 Creator에게 204를 반환한다.
- 비멤버·권한 없는 Member·없는 프로젝트·이미 삭제된 프로젝트가 설계된 상태 코드와 오류 코드를 반환한다.
- 삭제 시 프로젝트 행은 보존되고 deletedAt, updatedAt이 기록된다.
- 목록 count/rows, 수정 조회/update, 워크스페이스 상세 project count가 삭제된 프로젝트를 제외한다.
- 하위 화이트보드 문서가 물리 삭제되지 않는다.
- migration 파일이 생성되지만 실제 DB migration은 실행되지 않는다.
- 관련 테스트·lint·build·변경 파일 format 검증이 통과한다. 기존 baseline의 무관한 format 경고는 후속 정리 대상으로 남긴다.
- Implementation Results에 실제 변경과 검증 결과를 기록했다.
- 최종 리뷰 finding 수정과 SDD 보고서 추적 제외가 하나의 fix commit 범위로 정리됐고, Git push·PR은 실행하지 않았다.

## Implementation Results

### 실제 변경 내용

- `backend/src/db/schema/projects.ts`에 nullable `projects.deletedAt`(`deleted_at`, timezone timestamp)를 추가했다.
- `backend/src/db/migrations/0002_wandering_bruce_banner.sql`과 Drizzle meta snapshot/journal을 생성했다. SQL은 `projects.deleted_at` nullable 컬럼 추가만 수행한다.
- `backend/src/services/project.service.ts`에 Owner 또는 프로젝트 Creator만 처리하는 `deleteProject`를 추가하고, membership·활성 프로젝트 조회·soft delete를 하나의 transaction으로 묶었다. 삭제 시 `deletedAt`과 `updatedAt`을 같은 시각으로 기록하고 `returning` 결과가 없으면 `PROJECT_NOT_FOUND`를 반환한다.
- `backend/src/controllers/project.controller.ts`와 `backend/src/routes/project.routes.ts`에 인증된 `DELETE /workspaces/:workspaceId/projects/:projectId`를 연결했다. 성공 응답은 204 No Content다.
- `backend/src/constants/messages.ts`에 `PROJECT_DELETE_FORBIDDEN`을 추가했다.
- `backend/tests/project.test.ts`와 `backend/tests/db-schema.test.ts`에 삭제 권한·인증·UUID·비멤버·중복/대상 없음·DB 오류·활성 목록/수정 필터 및 schema 검증을 추가했다.
- 목록의 count/rows와 수정 조회/update에 `deletedAt IS NULL` 조건을 적용했으며, 하위 화이트보드 문서는 삭제하지 않는다.
- 최종 리뷰 수정에서 `backend/src/services/workspace.service.ts`의 상세 project count에도 `deletedAt IS NULL` 조건을 적용하고 `backend/tests/workspace.test.ts`의 회귀 계약을 보강했다.
- 로컬 SDD artifact인 `.superpowers/sdd/2026-09-09-project-delete-backend-implementation-plan/task-1-report.md`는 파일을 보존하면서 Git 추적에서 제외했다.

### 계획과 달라진 점

- Task 1, Task 4는 계획과 동일하게 구현했다.
- Task 2(실패 테스트)와 Task 3(서비스·컨트롤러·라우트 구현)는 작업 효율을 위해 `f26c212`에서 원자적으로 함께 반영했다. 테스트 우선 계약은 유지했고, 이후 `920024c` 리뷰 수정에서 성공 삭제 테스트가 membership query의 workspace/user 조건까지 검증하도록 보강했다.
- 최초 계획에는 워크스페이스 상세 `counts.projectCount`의 활성 프로젝트 필터가 빠져 있었다. 최종 리뷰 fix에서 설계·계획 범위를 보완하고 TDD로 service와 테스트를 수정했다.
- 실제 DB migration 적용은 수행하지 않았다.

### 실행한 검증 명령과 결과

- `pnpm --dir backend test -- tests/project.test.ts tests/db-schema.test.ts` — PASS, Test Files 2 passed, Tests 65 passed, exit 0.
- `pnpm --dir backend test` — PASS, Test Files 20 passed, Tests 173 passed, exit 0.
- `pnpm --dir backend lint` — PASS, ESLint 오류 없음, exit 0.
- `pnpm --dir backend build` — PASS, `tsc && tsc-alias --resolve-full-paths` 완료, exit 0.
- `pnpm --dir backend exec prettier --check src/db/schema/projects.ts src/services/project.service.ts src/controllers/project.controller.ts src/routes/project.routes.ts src/constants/messages.ts tests/db-schema.test.ts tests/project.test.ts` — PASS, 이번 변경 파일 7개 포맷 검사 완료.
- `pnpm --dir backend exec prettier --check src tests` — FAIL, 이번 변경과 무관한 기존 추적 파일 `src/db/migrations/meta/0000_snapshot.json`, `src/scripts/create-test-user.ts` 2개에서만 포맷 경고. 두 파일은 기준 커밋에서도 동일하게 실패하며 수정하지 않았다.
- `git diff --check` — PASS, whitespace 오류 없음, exit 0.
- `git status --short` — 기존 구현 종료 당시 승인된 설계 문서와 구현 계획 문서만 미추적 상태였으며, 기존 구현 파일과 `.superpowers` 보고서를 보존했다.
- `pnpm --dir backend db:migrate` — 실행하지 않음. 요구사항대로 migration 파일만 생성했다.

### 최종 리뷰 fix round 검증 결과

- RED `pnpm --dir backend test -- tests/workspace.test.ts --silent` — 예상 실패, Test Files 1 failed, Tests 1 failed | 29 passed, exit 1. project count query의 활성 프로젝트 조건 누락을 재현했다.
- GREEN `pnpm --dir backend test -- tests/workspace.test.ts` — PASS, Test Files 1 passed, Tests 30 passed, exit 0.
- `pnpm --dir backend test -- tests/workspace.test.ts tests/project.test.ts` — PASS, Test Files 2 passed, Tests 93 passed, exit 0.
- `pnpm --dir backend test` — PASS, Test Files 20 passed, Tests 173 passed, exit 0.
- `pnpm --dir backend lint` — PASS, ESLint 오류 없음, exit 0.
- `pnpm --dir backend build` — PASS, `tsc && tsc-alias --resolve-full-paths` 완료, exit 0.
- `pnpm --dir backend exec prettier --check src/services/workspace.service.ts tests/workspace.test.ts` — PASS, 변경 source/test 2개 포맷 검사 완료.
- `pnpm --dir backend exec prettier --check src tests` — FAIL, 기존 baseline과 동일하게 `src/db/migrations/meta/0000_snapshot.json`, `src/scripts/create-test-user.ts` 2개에서만 포맷 경고. 이번 fix 범위에서는 수정하지 않았다.
- `git diff --check` — PASS, whitespace 오류 없음, exit 0.
- `.superpowers/sdd/2026-09-09-project-delete-backend-implementation-plan/task-1-report.md` — 로컬 파일 보존, Git index 제거 완료.
- `pnpm --dir backend db:migrate` — 실행하지 않음. 기존 계획대로 실제 migration은 적용하지 않았다.

### 남은 후속 작업

- 기존 baseline의 Prettier 포맷 경고 2개를 별도 정리 작업으로 처리해야 한다. 이번 Task 5에서는 구현 파일을 임의 수정하지 않았다.
- 실제 환경에서 migration 적용, 프로젝트 복구 API, 영구 삭제/보존 기간 정리, 화이트보드 문서 API의 상위 프로젝트 삭제 상태 연동은 범위 밖이다.
- 기존 baseline 포맷 경고 2개는 별도 정리 작업으로 남긴다. 최종 리뷰 finding과 문서 정합성 보강은 완료했다.
