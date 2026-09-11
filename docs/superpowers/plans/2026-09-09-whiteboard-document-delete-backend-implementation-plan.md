# 화이트보드 문서 삭제 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증된 워크스페이스 Owner 또는 화이트보드 문서 Creator가 문서를 소프트 삭제하고, 삭제된 문서가 활성 API 흐름에 다시 노출되지 않도록 한다.

**Architecture:** 기존 `routes → controllers → services → db/schema` 경계를 유지한다. `whiteboard_documents.deleted_at` nullable 컬럼을 추가하고, 문서 삭제 service transaction에서 멤버십·활성 프로젝트·활성 문서·권한을 순서대로 확인한 뒤 `deletedAt`과 `updatedAt`을 갱신한다. 문서 목록과 이름 변경 query에도 `deletedAt IS NULL`을 적용한다.

**Tech Stack:** Node.js 20+, TypeScript, Express, Drizzle ORM/PostgreSQL, Zod, Vitest, Supertest, pnpm

**Spec:** `docs/superpowers/specs/2026-09-09-whiteboard-document-delete-backend-design.md`

## Global Constraints

- API 경로는 `DELETE /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId`로 고정한다.
- 성공 응답은 `204 No Content`이며 응답 본문은 없다.
- 삭제는 물리 삭제가 아닌 `deleted_at` 기반 소프트 삭제다.
- `deleted_at`은 nullable `timestamp with time zone`이며 기존 행과 새 문서는 `NULL`로 시작한다.
- 멤버십 → 활성 프로젝트 → 활성 문서 → 권한 순서로 확인한다.
- 비멤버는 `404 WORKSPACE_NOT_FOUND`를 받고 프로젝트·문서 query를 실행하지 않는다.
- 삭제된 프로젝트는 `PROJECT_NOT_FOUND`, 삭제된 문서는 `WHITEBOARD_DOCUMENT_NOT_FOUND`다.
- Owner 또는 문서 Creator만 삭제할 수 있고, 다른 Member는 `403 WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN`이다.
- 목록 count/rows와 이름 변경 문서 조회/update 조건은 `deletedAt IS NULL`을 사용한다.
- 삭제 update는 `deletedAt`과 `updatedAt`만 설정하고 `canvasContent`를 변경하지 않는다.
- 복구·영구 삭제·프론트엔드 UI·삭제 이벤트·감사 로그·실제 DB migration 적용은 범위에서 제외한다.
- 기존 화이트보드 문서 생성·목록·이름 변경 API의 외부 계약은 유지한다.
- Git commit·push·merge·PR은 사용자가 별도 요청하지 않았으므로 실행하지 않는다.

---

## 파일 구조 및 책임

- `backend/src/db/schema/whiteboard-documents.ts`
  - `deletedAt` Drizzle 컬럼을 선언한다.
- `backend/src/db/migrations/0003_*.sql`
  - `whiteboard_documents.deleted_at` nullable 컬럼 추가 SQL을 보관한다. 실제 파일명은 `drizzle-kit generate`가 생성한 이름을 사용한다.
- `backend/src/db/migrations/meta/_journal.json`, `backend/src/db/migrations/meta/0003_snapshot.json`
  - Drizzle migration metadata를 갱신한다.
- `backend/src/constants/messages.ts`
  - 문서 삭제 권한 오류 메시지를 선언한다.
- `backend/src/services/whiteboard-document.service.ts`
  - 활성 문서 필터를 기존 목록·이름 변경 흐름에 적용하고, transaction 기반 삭제 유스케이스를 구현한다.
- `backend/src/controllers/whiteboard-document.controller.ts`
  - DELETE path parameter 검증, 인증 사용자 추출, 204 응답을 담당한다.
- `backend/src/routes/whiteboard-document.routes.ts`
  - 인증된 `DELETE /:documentId` route를 등록한다.
- `backend/tests/db-schema.test.ts`
  - `whiteboardDocuments.deletedAt` 컬럼 export를 검증한다.
- `backend/tests/whiteboard-document.test.ts`
  - DELETE HTTP 계약과 기존 목록·수정의 활성 문서 조건을 검증한다.
- `docs/superpowers/plans/2026-09-09-whiteboard-document-delete-backend-implementation-plan.md`
  - 구현 체크리스트와 구현 후 실제 결과를 기록한다.

---

### Task 1: 문서 소프트 삭제 컬럼과 migration 추가

**Files:**

- Modify: `backend/tests/db-schema.test.ts`
- Modify: `backend/src/db/schema/whiteboard-documents.ts`
- Create: `backend/src/db/migrations/0003_*.sql` — 실제 파일명은 `pnpm --dir backend db:generate` 출력에 따라 생성
- Create: `backend/src/db/migrations/meta/0003_snapshot.json` — Drizzle 생성 metadata
- Modify: `backend/src/db/migrations/meta/_journal.json`

**Interfaces:**

- Consumes: 기존 `whiteboardDocuments` Drizzle table과 schema export 테스트 패턴
- Produces: `whiteboardDocuments.deletedAt` 컬럼과 `whiteboard_documents.deleted_at` database migration

- [x] **Step 1: `deletedAt` 컬럼을 요구하는 실패 테스트를 작성한다.**

`backend/tests/db-schema.test.ts`에 다음 테스트를 추가한다.

```ts
it("whiteboardDocuments schema exposes a nullable deletedAt column", () => {
  expect(schema.whiteboardDocuments.deletedAt).toBeDefined();
});
```

- [x] **Step 2: schema 테스트가 컬럼 부재로 실패하는지 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/db-schema.test.ts
```

Expected: `schema.whiteboardDocuments.deletedAt`가 아직 정의되지 않아 새 테스트가 실패하고, 기존 schema export 테스트는 통과한다.

- [x] **Step 3: nullable `deletedAt` 컬럼을 Drizzle schema에 추가한다.**

`backend/src/db/schema/whiteboard-documents.ts`의 `updatedAt` 뒤에 다음 컬럼을 추가한다.

```ts
deletedAt: timestamp("deleted_at", { withTimezone: true }),
```

`notNull()`과 default는 추가하지 않는다. 기존 행과 새 문서의 `NULL`이 활성 상태를 의미해야 한다.

- [x] **Step 4: schema 테스트가 통과하는지 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/db-schema.test.ts
```

Expected: schema 테스트 전체가 PASS한다.

- [x] **Step 5: Drizzle migration을 생성한다.**

Run:

```bash
pnpm --dir backend db:generate
```

Expected: 다음 의미의 SQL을 포함하는 새 `0003_*.sql`과 관련 metadata가 생성된다.

```sql
ALTER TABLE "whiteboard_documents" ADD COLUMN "deleted_at" timestamp with time zone;
```

`pnpm --dir backend db:migrate`는 실행하지 않는다.

- [x] **Step 6: migration diff가 nullable 컬럼 추가만 포함하는지 확인한다.**

Run:

```bash
rg -n -C 2 'deleted_at|whiteboard_documents' backend/src/db/migrations
git diff --check
```

Expected: 새 migration에는 `whiteboard_documents.deleted_at` nullable 컬럼 추가가 있고, 기존 migration SQL이나 unrelated schema가 변경되지 않는다.

---

#### Task 1 Implementation Results

##### 실제 변경 내용

- `whiteboardDocuments` Drizzle schema와 schema export 테스트에 nullable `deletedAt` 컬럼을 추가했다.
- Drizzle이 `0003_misty_zarda.sql`, `0003_snapshot.json`, `_journal.json`의 0003 entry를 생성했다.
- 생성 SQL은 `whiteboard_documents.deleted_at` nullable `timestamp with time zone` 컬럼 추가 1문장이다.

##### 계획과 달라진 점

- 계획과 동작 범위는 동일하며, migration 파일명만 Drizzle 생성 결과인 `0003_misty_zarda.sql`을 사용했다.
- 실제 DB 적용 명령 `pnpm --dir backend db:migrate`는 브리프와 설계 범위에 따라 실행하지 않았다.

##### 실행한 검증 명령과 결과

- 기준 schema test: 2 tests passed.
- RED: 3 tests 중 새 `deletedAt` 테스트 1개 실패, 기존 2개 통과.
- GREEN/final focused test: 3 tests passed.
- `pnpm --dir backend db:generate`: exit 0.
- migration `rg` inspection, `jq` snapshot nullability inspection, `git diff --check`, lint, build, changed-file Prettier check: 모두 exit 0.

##### 남은 후속 작업

- 후속 Task 2 이후 구현에서 활성 문서 query에 `deletedAt IS NULL`을 적용한다.
- 배포 시점에 생성된 0003 migration을 실제 데이터베이스에 적용한다.
- 전체 기능 구현 완료 시 계획 문서 하단의 전체 `Implementation Results`를 갱신한다.

검증 상세 보고서: `.superpowers/sdd/2026-09-09-whiteboard-document-delete-backend-implementation-plan/task-1-report.md`

---

### Task 2: DELETE 및 활성 문서 필터의 실패 테스트 작성

**Files:**

- Modify: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**

- Consumes: Task 1의 `whiteboardDocuments.deletedAt`, 기존 `createApp()`, `signAccessToken()`, Drizzle mock 패턴
- Produces: `mockWhiteboardDocumentDeleteTransaction()` helper와 삭제·목록·수정 회귀 테스트

- [x] **Step 1: DELETE transaction mock helper를 추가한다.**

기존 `mockWhiteboardDocumentUpdateTransaction`과 같은 위치에 다음 호출 순서를 지원하는 helper를 추가한다.

```ts
function mockWhiteboardDocumentDeleteTransaction({
  membershipRows = [{ role: "owner" }],
  projectRows = [{ id: projectId }],
  documentRows = [{ id: createdWhiteboardDocument.id, creatorId: "user-2" }],
  deletedDocumentRows = [{ id: createdWhiteboardDocument.id }],
  membershipError,
  projectError,
  documentError,
  deleteError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  documentRows?: unknown[];
  deletedDocumentRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  documentError?: Error;
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
  const documentQuery = {
    from: vi.fn().mockReturnThis(),
    where: documentError
      ? vi.fn().mockRejectedValue(documentError)
      : vi.fn().mockResolvedValue(documentRows),
  };
  const documentUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: deleteError
      ? vi.fn().mockRejectedValue(deleteError)
      : vi.fn().mockResolvedValue(deletedDocumentRows),
  };
  const transaction = {
    select: vi
      .fn()
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(projectQuery)
      .mockReturnValueOnce(documentQuery),
    update: vi.fn().mockReturnValue(documentUpdate),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) =>
    callback(transaction as never),
  );

  return {
    membershipQuery,
    projectQuery,
    documentQuery,
    documentUpdate,
    transaction,
  };
}
```

- [x] **Step 2: Owner와 Creator 성공 테스트를 작성한다.**

`DELETE /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId` describe를 추가한다. Owner 성공 테스트는 다음 계약을 고정한다.

```ts
const deletePath = `/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents/${createdWhiteboardDocument.id}`;

it("Owner가 다른 Creator의 문서를 삭제하고 204를 반환한다", async () => {
  const { documentUpdate, transaction } =
    mockWhiteboardDocumentDeleteTransaction();

  const response = await request(createApp())
    .delete(deletePath)
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  expect(transaction.select).toHaveBeenCalledTimes(3);
  expect(documentUpdate.set).toHaveBeenCalledWith({
    deletedAt: expect.any(Date),
    updatedAt: expect.any(Date),
  });

  const values = documentUpdate.set.mock.calls[0]?.[0] as {
    deletedAt: Date;
    updatedAt: Date;
  };
  expect(values.deletedAt).toEqual(values.updatedAt);
});

it("문서 Creator인 Member가 자신의 문서를 삭제할 수 있다", async () => {
  const { documentUpdate } = mockWhiteboardDocumentDeleteTransaction({
    membershipRows: [{ role: "member" }],
    documentRows: [{ id: createdWhiteboardDocument.id, creatorId: "user-1" }],
  });

  const response = await request(createApp())
    .delete(deletePath)
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(204);
  expect(documentUpdate.set).toHaveBeenCalledOnce();
});
```

성공 테스트에는 다음 query 조건도 추가한다.

```ts
expect(documentQuery.where).toHaveBeenCalledWith(
  and(
    eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
    eq(whiteboardDocuments.projectId, projectId),
    isNull(whiteboardDocuments.deletedAt),
  ),
);
expect(documentUpdate.where).toHaveBeenCalledWith(
  and(
    eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
    eq(whiteboardDocuments.projectId, projectId),
    isNull(whiteboardDocuments.deletedAt),
  ),
);
expect(documentUpdate.returning).toHaveBeenCalledWith({
  id: whiteboardDocuments.id,
});
```

- [x] **Step 3: 인증·입력·권한·존재 여부·DB 오류 테스트를 작성한다.**

다음 시나리오를 각각 검증한다.

1. Authorization header가 없으면 401 `UNAUTHORIZED`이고 `db.transaction`을 호출하지 않는다.
2. `workspaceId`, `projectId`, `documentId` 중 하나가 UUID가 아니면 400 `VALIDATION_ERROR`이고 transaction을 호출하지 않는다.
3. 멤버십 rows가 비어 있으면 404 `WORKSPACE_NOT_FOUND`이며 project/document/update query를 실행하지 않는다.
4. project rows가 비어 있으면 404 `PROJECT_NOT_FOUND`이며 document/update query를 실행하지 않는다.
5. document rows가 비어 있으면 404 `WHITEBOARD_DOCUMENT_NOT_FOUND`이며 update를 실행하지 않는다. 이미 삭제된 문서도 활성 document query에서 rows가 비어 있는 동일한 계약으로 검증한다.
6. `membership.role === "member"`이고 document creator가 다른 사용자면 403 `WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN`이며 update하지 않는다.
7. `membershipError`, `projectError`, `documentError`, `deleteError` 각각은 500 `INTERNAL_SERVER_ERROR`다.
8. `deletedDocumentRows: []`는 동시 삭제/재삭제 경계로 404 `WHITEBOARD_DOCUMENT_NOT_FOUND`를 반환한다.

- [x] **Step 4: 기존 목록 query의 활성 문서 조건 회귀 테스트를 갱신한다.**

기존 GET 테스트의 count/rows where 기대값을 다음처럼 변경한다.

```ts
expect(countQuery.where).toHaveBeenCalledWith(
  and(
    eq(whiteboardDocuments.projectId, projectId),
    isNull(whiteboardDocuments.deletedAt),
    ilike(whiteboardDocuments.name, "%Brand%"),
  ),
);
expect(documentQuery.where).toHaveBeenCalledWith(
  and(
    eq(whiteboardDocuments.projectId, projectId),
    isNull(whiteboardDocuments.deletedAt),
    ilike(whiteboardDocuments.name, "%Brand%"),
  ),
);
```

검색어가 없는 테스트도 `eq(whiteboardDocuments.projectId, projectId)`와 `isNull(whiteboardDocuments.deletedAt)`를 함께 기대하도록 갱신한다. 응답 projection에는 `deletedAt`을 추가하지 않는다.

- [x] **Step 5: 기존 PATCH query의 활성 문서 조건 회귀 테스트를 갱신한다.**

기존 PATCH 성공 테스트의 document select와 update where 기대값에 `isNull(whiteboardDocuments.deletedAt)`를 추가한다.

```ts
expect(documentQuery.where).toHaveBeenCalledWith(
  and(
    eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
    eq(whiteboardDocuments.projectId, projectId),
    isNull(whiteboardDocuments.deletedAt),
  ),
);
expect(documentUpdate.where).toHaveBeenCalledWith(
  and(
    eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
    eq(whiteboardDocuments.projectId, projectId),
    isNull(whiteboardDocuments.deletedAt),
  ),
);
```

- [x] **Step 6: 새 테스트가 feature-missing 상태로 실패하는지 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/db-schema.test.ts tests/whiteboard-document.test.ts
```

Expected: schema 테스트는 통과하고, 새 DELETE route가 아직 없어 DELETE 테스트가 404로 실패하며 목록·PATCH의 `deletedAt` 조건 기대도 실패한다. 테스트 mock 자체의 오류가 아니라 미구현 기능 때문에 실패하는지 확인한다.

---

### Task 3: 메시지·service·controller·route 구현

**Files:**

- Modify: `backend/src/constants/messages.ts`
- Modify: `backend/src/services/whiteboard-document.service.ts`
- Modify: `backend/src/controllers/whiteboard-document.controller.ts`
- Modify: `backend/src/routes/whiteboard-document.routes.ts`
- Test: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**

- Consumes: Task 1의 `whiteboardDocuments.deletedAt`, Task 2의 DELETE 계약과 활성 filter 기대값
- Produces: `DeleteWhiteboardDocumentInput`, `deleteWhiteboardDocument()`, 인증된 DELETE endpoint

- [x] **Step 1: 삭제 권한 오류 메시지를 추가한다.**

`backend/src/constants/messages.ts`의 기존 화이트보드 문서 메시지 근처에 다음 항목을 추가한다.

```ts
WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN: "화이트보드 문서를 삭제할 권한이 없습니다",
```

- [x] **Step 2: 기존 목록·이름 변경 service에 활성 문서 조건을 반영한다.**

`backend/src/services/whiteboard-document.service.ts`의 목록 `whereCondition`을 다음 의미로 변경한다.

```ts
const whereCondition = and(
  eq(whiteboardDocuments.projectId, projectId),
  isNull(whiteboardDocuments.deletedAt),
  search
    ? ilike(whiteboardDocuments.name, buildContainsSearchPattern(search))
    : undefined,
);
```

이름 변경의 document select와 update where에도 다음 조건을 함께 넣는다.

```ts
and(
  eq(whiteboardDocuments.id, documentId),
  eq(whiteboardDocuments.projectId, projectId),
  isNull(whiteboardDocuments.deletedAt),
);
```

이 변경으로 삭제된 문서는 목록 count/rows와 이름 변경의 대상에서 제외되고, 기존 update service는 `WHITEBOARD_DOCUMENT_NOT_FOUND`를 반환한다.

- [x] **Step 3: `DeleteWhiteboardDocumentInput`과 service 유스케이스를 구현한다.**

`backend/src/services/whiteboard-document.service.ts`의 입력 type 영역에 다음 interface를 추가한다.

```ts
export interface DeleteWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  documentId: string;
  userId: string;
}
```

`deleteWhiteboardDocument`는 다음 순서와 query 조건을 정확히 사용한다.

```ts
export async function deleteWhiteboardDocument({
  workspaceId,
  projectId,
  documentId,
  userId,
}: DeleteWhiteboardDocumentInput): Promise<void> {
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
      throw new HttpError(
        404,
        "WORKSPACE_NOT_FOUND",
        ERROR_MESSAGES.WORKSPACE_NOT_FOUND,
      );
    }

    const [project] = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.workspaceId, workspaceId),
          isNull(projects.deletedAt),
        ),
      );

    if (!project) {
      throw new HttpError(
        404,
        "PROJECT_NOT_FOUND",
        ERROR_MESSAGES.PROJECT_NOT_FOUND,
      );
    }

    const [whiteboardDocument] = await tx
      .select({
        id: whiteboardDocuments.id,
        creatorId: whiteboardDocuments.creatorId,
      })
      .from(whiteboardDocuments)
      .where(
        and(
          eq(whiteboardDocuments.id, documentId),
          eq(whiteboardDocuments.projectId, projectId),
          isNull(whiteboardDocuments.deletedAt),
        ),
      );

    if (!whiteboardDocument) {
      throw new HttpError(
        404,
        "WHITEBOARD_DOCUMENT_NOT_FOUND",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
      );
    }

    if (
      membership.role !== "owner" &&
      whiteboardDocument.creatorId !== userId
    ) {
      throw new HttpError(
        403,
        "WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN,
      );
    }

    const now = new Date();
    const [deletedWhiteboardDocument] = await tx
      .update(whiteboardDocuments)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(whiteboardDocuments.id, documentId),
          eq(whiteboardDocuments.projectId, projectId),
          isNull(whiteboardDocuments.deletedAt),
        ),
      )
      .returning({ id: whiteboardDocuments.id });

    if (!deletedWhiteboardDocument) {
      throw new HttpError(
        404,
        "WHITEBOARD_DOCUMENT_NOT_FOUND",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
      );
    }
  });
}
```

`now`은 한 번만 생성해 `deletedAt`과 `updatedAt`의 값이 같도록 한다. update `.set()`에는 두 필드만 포함하고 `canvasContent`는 건드리지 않는다.

- [x] **Step 4: controller DELETE handler를 구현한다.**

`backend/src/controllers/whiteboard-document.controller.ts`에서 service import에 `deleteWhiteboardDocument`를 추가하고 다음 handler를 추가한다.

```ts
export async function deleteWhiteboardDocumentHandler(
  req: Request,
  res: Response,
) {
  const user = requireUser(req);
  const { workspaceId, projectId, documentId } = parseOrThrow(
    whiteboardDocumentUpdateParamsSchema,
    req.params,
  );

  await deleteWhiteboardDocument({
    workspaceId,
    projectId,
    documentId,
    userId: user.sub,
  });

  res.status(204).send();
}
```

수정 API와 동일한 `whiteboardDocumentUpdateParamsSchema`를 사용해 세 path parameter의 UUID 규칙과 validation 오류 계약을 유지한다.

- [x] **Step 5: route를 인증 middleware와 연결한다.**

`backend/src/routes/whiteboard-document.routes.ts`의 controller import에 handler를 추가하고 PATCH route 뒤에 다음 route를 등록한다.

```ts
whiteboardDocumentRouter.delete(
  "/:documentId",
  authenticate,
  asyncHandler(deleteWhiteboardDocumentHandler),
);
```

- [x] **Step 6: 대상 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir backend test -- tests/db-schema.test.ts tests/whiteboard-document.test.ts
```

Expected: schema·생성·목록·이름 변경·삭제 테스트가 모두 PASS한다. 삭제 성공은 204, 권한·미존재·검증·DB 오류는 설계 문서의 상태 코드와 error code를 사용한다.

---

### Task 4: 전체 검증과 구현 결과 기록

**Files:**

- Verify: `backend/src/db/schema/whiteboard-documents.ts`
- Verify: generated `backend/src/db/migrations/0003_*.sql` and `backend/src/db/migrations/meta/0003_snapshot.json`
- Verify: `backend/src/constants/messages.ts`
- Verify: `backend/src/services/whiteboard-document.service.ts`
- Verify: `backend/src/controllers/whiteboard-document.controller.ts`
- Verify: `backend/src/routes/whiteboard-document.routes.ts`
- Verify: `backend/tests/db-schema.test.ts`
- Verify: `backend/tests/whiteboard-document.test.ts`
- Modify after implementation: this plan document

**Interfaces:**

- Consumes: Task 3의 구현과 대상 테스트 PASS 결과
- Produces: 전체 검증 결과와 계획 대비 실제 변경 기록

- [x] **Step 1: backend 전체 테스트를 실행한다.**

Run:

```bash
pnpm --dir backend test
```

Expected: 전체 Vitest suite가 PASS하고, 기존 기능의 회귀 실패가 없다.

- [ ] **Step 2: lint/build/focused Prettier는 PASS했으나 broad Prettier concern으로 부분 완료한다.**

Run:

```bash
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src/constants/messages.ts src/services/whiteboard-document.service.ts src/controllers/whiteboard-document.controller.ts src/routes/whiteboard-document.routes.ts src/db/schema/whiteboard-documents.ts tests/db-schema.test.ts tests/whiteboard-document.test.ts
pnpm --dir backend exec prettier --check src tests
```

Expected: lint·TypeScript build·변경된 source/test 파일의 focused Prettier는 PASS한다. broad `pnpm --dir backend exec prettier --check src tests`는 generated Drizzle metadata 3개 경고로 exit 1이며, 따라서 Step 2의 전체 성공 조건은 충족되지 않은 부분 검증 상태로 기록한다.

- [x] **Step 3: migration 적용 없이 diff와 범위를 확인한다.**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: 변경은 승인된 설계의 schema, migration metadata, backend API, 테스트, 계획 문서 범위에만 포함되고, `pnpm --dir backend db:migrate`는 실행하지 않는다.

- [x] **Step 4: 이 계획 문서에 `Implementation Results`를 추가한다.**

구현 완료 후 문서 마지막에 다음 항목을 실제 결과로 기록한다.

```markdown
## Implementation Results

### 실제 변경 내용

- 실제로 추가·수정한 파일과 동작을 기록한다.

### 계획과 달라진 점

- 계획과 동일하면 "계획과 동일"이라고 기록하고, 차이가 있으면 이유와 영향 범위를 기록한다.

### 실행한 검증 명령과 결과

- 실행한 각 명령과 PASS/실패 결과를 기록한다.

### 남은 후속 작업

- 실제 DB migration 적용, 복구 API 등 이번 범위 밖의 후속 작업을 기록한다.
```

구현 결과에는 테스트·lint·build·format·diff check의 실제 출력에 근거한 결과만 기록한다.

## Implementation Results

### 실제 변경 내용

- `backend/src/db/schema/whiteboard-documents.ts`에 nullable `deletedAt` 컬럼을 추가했다.
- `backend/src/db/migrations/0003_misty_zarda.sql`, `meta/0003_snapshot.json`, `meta/_journal.json`에 `whiteboard_documents.deleted_at` migration metadata를 반영했다. SQL은 nullable `timestamp with time zone` 컬럼 추가 1문장이다.
- `backend/src/constants/messages.ts`, `backend/src/services/whiteboard-document.service.ts`, `backend/src/controllers/whiteboard-document.controller.ts`, `backend/src/routes/whiteboard-document.routes.ts`에 권한 메시지, 활성 문서 필터, transaction 기반 soft delete, 인증 DELETE `204` endpoint를 구현했다.
- `createWhiteboardDocument`는 기존 생성 응답 계약의 7개 필드만 반환하도록 projection을 명시해 `deletedAt` 노출을 차단했고, 서비스 반환 타입과 생성 회귀 assertion을 함께 갱신했다.
- `backend/tests/db-schema.test.ts`와 `backend/tests/whiteboard-document.test.ts`에 schema·목록·이름 변경·DELETE 계약 및 오류 경계 테스트를 반영했다.
- Task 4에서는 이 계획 문서의 체크리스트와 최종 `Implementation Results`를 갱신하고 별도 전체 보고서를 작성했다.

### 계획과 달라진 점

- 핵심 동작·API 계약·구현 파일 범위는 계획과 동일하다.
- migration 파일명은 계획대로 `drizzle-kit` 생성 결과인 `0003_misty_zarda.sql`을 사용했다.
- 기존 provisional 결과의 RED 기준선은 현재 구현 상태에서 재현하지 않았고, 현재 worktree에서 focused GREEN과 exact full test를 새로 실행한 결과만 최종 검증값으로 기록했다.
- focused Prettier는 통과했지만 exact broad check는 생성 Drizzle metadata인 `_journal.json`, `0000_snapshot.json`, `0003_snapshot.json` 경고 3건으로 exit 1이다. 지시대로 unrelated/generated metadata를 포맷 변경하지 않았다.
- 현재 worktree에는 설계·계획 문서와 migration 파일이 untracked 상태로 함께 존재하며, `git diff --stat`에는 untracked 파일이 포함되지 않는다. `git status --short`로 별도 확인했다.

### 실행한 검증 명령과 결과

- `pnpm --dir backend test` → exit 0, `Test Files 21 passed (21)`, `Tests 262 passed (262)`.
- `pnpm --dir backend test -- tests/db-schema.test.ts tests/whiteboard-document.test.ts` → exit 0, `Test Files 2 passed (2)`, `Tests 81 passed (81)`.
- `pnpm --dir backend lint` → exit 0.
- `pnpm --dir backend build` → exit 0.
- `pnpm --dir backend exec prettier --check src/constants/messages.ts src/services/whiteboard-document.service.ts src/controllers/whiteboard-document.controller.ts src/routes/whiteboard-document.routes.ts src/db/schema/whiteboard-documents.ts tests/db-schema.test.ts tests/whiteboard-document.test.ts` → exit 0, `All matched files use Prettier code style!`.
- `pnpm --dir backend exec prettier --check src tests` → exit 1; 경고 파일은 `_journal.json`, `0000_snapshot.json`, `0003_snapshot.json` 3개다.
- `rg -n -C 2 'deleted_at|whiteboard_documents' backend/src/db/migrations` → `0003_misty_zarda.sql`의 `ALTER TABLE "whiteboard_documents" ADD COLUMN "deleted_at" timestamp with time zone;` 및 snapshot의 `notNull: false`를 확인했다.
- `git diff --check` → exit 0.
- `git status --short` → modified 8개는 source/test 7개와 generated migration metadata `_journal.json` 1개이며, migration SQL/snapshot 및 설계·계획 문서 4개는 untracked임을 확인했다.
- `git diff --stat` → tracked diff 기준 8 files changed, `423 insertions(+)`, `7 deletions(-)`.
- `pnpm --dir backend db:migrate`는 실행하지 않았다.

### Self-review

- DELETE route는 기존 `Router({ mergeParams: true })`에 `authenticate`와 `asyncHandler`를 유지해 연결되어 있다.
- service는 멤버십 → 활성 프로젝트 → 활성 문서 → 권한 순서로 확인하고, 목록·이름 변경·삭제 query 모두 `deletedAt IS NULL`을 적용한다.
- soft delete update는 단일 `now`로 `deletedAt`과 `updatedAt`만 설정하며 `canvasContent`를 변경하지 않는다. `returning`이 비면 404로 처리한다.
- 복구·hard delete·frontend·실제 DB migration 적용·commit/push는 이번 범위에 추가하지 않았다.

### 남은 후속 작업

- 배포 시 `dev` 병합 후 번호가 조정된 `0004_misty_zarda.sql`을 실제 데이터베이스에 적용한다.
- generated migration metadata의 broad Prettier 경고는 별도 generated-file 정리 범위에서 판단한다.
- 복구·영구 삭제·프론트엔드 UI가 필요하면 별도 설계와 작업으로 진행한다.
- 커밋·push는 사용자의 명시적 요청 전까지 하지 않는다.

### Concerns

- broad Prettier check만 생성 metadata 3건 때문에 실패했다. 변경된 source/test 파일 focused check, lint, build, full/focused test, diff check는 모두 통과했다.
