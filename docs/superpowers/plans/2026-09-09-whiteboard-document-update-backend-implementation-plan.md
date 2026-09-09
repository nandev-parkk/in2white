# 화이트보드 문서 이름 변경 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증된 워크스페이스 Owner 또는 화이트보드 문서 Creator가 문서 이름을 변경하고 최소 변경 결과를 받을 수 있는 PATCH API를 추가한다.

**Architecture:** 기존 `routes → controllers → services → db/schema` 경계를 유지한다. 화이트보드 문서 route에 인증된 PATCH handler를 연결하고, service transaction에서 멤버십·활성 프로젝트·문서 소속·권한을 순서대로 확인한 뒤 `name`과 `updatedAt`만 update한다. update returning과 HTTP 응답은 `id`, `name`, `updatedAt`으로 제한해 `canvasContent`를 전송하지 않는다.

**Tech Stack:** Node.js 20+, TypeScript, Express, Drizzle ORM/PostgreSQL, Zod, Vitest, Supertest, pnpm

**Spec:** `docs/superpowers/specs/2026-09-09-whiteboard-document-update-backend-design.md`

## Global Constraints

- API 경로는 `PATCH /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId`로 고정한다.
- body는 trim 후 1~50자인 `name` 하나만 받는다.
- 성공 응답은 `{ whiteboardDocument: { id, name, updatedAt } }`이며 `canvasContent`를 포함하지 않는다.
- `canvasContent` 수정·자동 저장·실시간 협업은 이번 작업에 포함하지 않는다.
- 멤버십이 없으면 `404 WORKSPACE_NOT_FOUND`이며 project/document query를 실행하지 않는다.
- 프로젝트가 없거나 다른 workspace에 속하거나 삭제되면 `404 PROJECT_NOT_FOUND`다.
- 문서가 없거나 요청 project에 속하지 않으면 `404 WHITEBOARD_DOCUMENT_NOT_FOUND`다.
- Owner 또는 document creator만 수정할 수 있고, 그 외 Member는 `403 WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN`이다.
- update 대상은 `name`, `updatedAt`으로 제한하고 update returning 대상은 `id`, `name`, `updatedAt`으로 제한한다.
- 기존 `whiteboard-documents` schema, migration, 생성·목록 API 동작은 유지한다.
- 구현 전에 새 PATCH 테스트가 기대된 이유로 실패하는 RED 상태를 확인한다.
- 사용자가 요청하지 않았으므로 Git commit, push, merge, PR은 실행하지 않는다.
- 구현 완료 후 이 계획 문서에 실제 변경, 검증 결과, 계획과의 차이, 후속 작업을 기록한다.

---

## 파일 구조 및 책임

### 수정 파일

- `backend/tests/whiteboard-document.test.ts`
  - PATCH HTTP 계약과 Drizzle transaction/query 경계를 테스트한다.
- `backend/src/constants/messages.ts`
  - 문서 ID·미존재·수정 권한 메시지를 추가한다.
- `backend/src/schemas/whiteboard-document.schema.ts`
  - 수정용 params/body schema를 추가한다.
- `backend/src/services/whiteboard-document.service.ts`
  - `UpdateWhiteboardDocumentInput`과 `updateWhiteboardDocument`를 추가한다.
  - 권한 확인과 최소 update returning projection을 구현한다.
- `backend/src/controllers/whiteboard-document.controller.ts`
  - 수정 params/body를 파싱하고 service 결과를 200으로 반환한다.
- `backend/src/routes/whiteboard-document.routes.ts`
  - `PATCH /:documentId`를 인증 route로 등록한다.

### 변경하지 않는 파일

- `backend/src/db/schema/whiteboard-documents.ts`
- `backend/src/db/migrations/**`
- `backend/src/routes/index.ts`
- `backend/src/services/project.service.ts`
- `frontend/**`

---

### Task 1: PATCH 회귀 테스트와 Drizzle transaction mock 작성

**Files:**

- Modify: `backend/tests/whiteboard-document.test.ts`
- Reference: `backend/src/services/project.service.ts`, 기존 화이트보드 생성 테스트 mock

**Interfaces:**

- Consumes: `PATCH /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId` 계약
- Produces: `mockWhiteboardDocumentUpdateTransaction` helper와 실패하는 PATCH 회귀 테스트

- [x] **Step 1: update fixture와 transaction mock chain을 추가한다.**

`createdWhiteboardDocument`와 별도로 update returning 결과를 만든다. 결과에는 반드시 `id`, `name`, `updatedAt`만 넣어 최소 projection을 고정한다. mock chain은 다음 호출 순서를 지원해야 한다.

```ts
transaction.select // membership
transaction.select // active project
transaction.select // document creator
transaction.update // document update
```

각 query는 `.from().where()`를 제공하고, update chain은 `.set().where().returning()`을 제공한다. membership, project, document, update 각각의 rows/error를 helper 인자로 제어한다.

- [x] **Step 2: 성공과 projection 테스트를 먼저 작성한다.**

다음 테스트를 추가한다.

1. Owner가 다른 Creator의 문서 이름을 변경하면 200이고 `id`, trimmed `name`, ISO `updatedAt`만 반환한다.
2. Member가 자신이 만든 문서 이름을 변경하면 200이다.
3. update `.set()`에는 trimmed `name`과 `updatedAt`만 들어간다.
4. 문서 조회 조건은 `documentId`와 `projectId`를 함께 사용하고, update 조건도 두 ID를 함께 사용한다.
5. response body와 update returning projection에 `canvasContent`가 없다.

성공 응답 검증은 다음 형태로 작성한다.

```ts
expect(response.body.whiteboardDocument).toEqual({
  id: updatedWhiteboardDocument.id,
  name: "변경된 문서 이름",
  updatedAt: updatedWhiteboardDocument.updatedAt.toISOString(),
});
expect(response.body.whiteboardDocument).not.toHaveProperty("canvasContent");
```

- [x] **Step 3: 입력·인증·권한·미존재·DB 오류 테스트를 작성한다.**

다음 계약을 각각 검증한다.

1. 인증 없음은 401 `UNAUTHORIZED`이고 transaction을 호출하지 않는다.
2. 잘못된 workspace/project/document UUID, name 누락·null·공백·비문자열·51자 이상은 400 `VALIDATION_ERROR`이고 transaction을 호출하지 않는다.
3. 비멤버는 404 `WORKSPACE_NOT_FOUND`이고 project/document/update query를 실행하지 않는다.
4. project가 없거나 다른 workspace에 속하거나 삭제된 경우 404 `PROJECT_NOT_FOUND`이고 document/update를 실행하지 않는다.
5. document가 없거나 다른 project에 속하면 404 `WHITEBOARD_DOCUMENT_NOT_FOUND`이고 update를 실행하지 않는다.
6. 문서 Creator가 아닌 Member는 403 `WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN`이고 update를 실행하지 않는다.
7. membership/project/document/update query 오류는 각각 500 `INTERNAL_SERVER_ERROR`다.

- [x] **Step 4: 새 테스트가 구현 누락으로 실패하는지 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

Expected: 새 PATCH 테스트가 route/service/schema 미구현으로 실패하고, 기존 생성·목록 테스트는 통과한다. 오류가 test mock 자체의 오타 때문에 발생하면 테스트를 먼저 수정한 뒤 feature-missing 실패를 확인한다.

---

### Task 2: 오류 메시지와 입력 schema 구현

**Files:**

- Modify: `backend/src/constants/messages.ts`
- Modify: `backend/src/schemas/whiteboard-document.schema.ts`
- Test: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**

- Consumes: Task 1의 validation 테스트
- Produces: `whiteboardDocumentUpdateParamsSchema`, `updateWhiteboardDocumentSchema`

- [x] **Step 1: 오류 메시지 상수를 추가한다.**

`ERROR_MESSAGES`에 다음 상수를 추가한다.

```ts
WHITEBOARD_DOCUMENT_ID_INVALID: "유효하지 않은 화이트보드 문서 ID입니다",
WHITEBOARD_DOCUMENT_NOT_FOUND: "화이트보드 문서를 찾을 수 없습니다",
WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN: "화이트보드 문서를 수정할 권한이 없습니다",
```

기존 `WHITEBOARD_DOCUMENT_NAME_REQUIRED`와 `WHITEBOARD_DOCUMENT_NAME_TOO_LONG`은 생성·수정에서 공유한다.

- [x] **Step 2: 수정용 params schema를 추가한다.**

기존 create/list가 사용하는 `whiteboardDocumentParamsSchema`는 두 UUID를 그대로 유지한다. 수정 route용 schema를 별도로 추가해 `documentId`가 필요한 기존 handler를 깨뜨리지 않는다.

```ts
export const whiteboardDocumentUpdateParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }),
  documentId: z.uuid({ error: ERROR_MESSAGES.WHITEBOARD_DOCUMENT_ID_INVALID }),
});
```

- [x] **Step 3: 수정 body schema를 추가한다.**

기존 `whiteboardDocumentNameSchema`를 재사용해 trim·1~50자 검증을 적용한다. PATCH에서 이름은 유일한 수정 필드이므로 optional로 만들지 않는다.

```ts
export const updateWhiteboardDocumentSchema = z.object({
  name: whiteboardDocumentNameSchema,
});
```

- [x] **Step 4: validation 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

Expected: schema 관련 400 테스트가 통과하거나, 아직 route/service가 연결되지 않은 PATCH 성공·권한 테스트만 실패한다.

---

### Task 3: 화이트보드 문서 수정 service 구현

**Files:**

- Modify: `backend/src/services/whiteboard-document.service.ts`
- Test: `backend/tests/whiteboard-document.test.ts`
- Reference: `backend/src/services/project.service.ts`

**Interfaces:**

- Consumes: `UpdateWhiteboardDocumentInput` with `workspaceId`, `projectId`, `documentId`, `userId`, `name`
- Produces: `updateWhiteboardDocument(input): Promise<{ id: string; name: string; updatedAt: Date }>`

- [x] **Step 1: update input과 최소 반환 타입을 정의한다.**

다음 타입을 기존 service 파일에 추가한다.

```ts
export interface UpdateWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  documentId: string;
  userId: string;
  name: string;
}

export interface UpdatedWhiteboardDocument {
  id: string;
  name: string;
  updatedAt: Date;
}
```

- [x] **Step 2: transaction에서 멤버십을 먼저 확인한다.**

`workspaceMemberships`에서 `workspaceId`와 `userId`가 일치하는 행의 `role`을 조회한다. 행이 없으면 `HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND)`를 발생시키고 project query를 실행하지 않는다.

- [x] **Step 3: 활성 프로젝트를 확인한다.**

`projects.id`, `projects.workspaceId`, `isNull(projects.deletedAt)` 조건으로 project를 조회한다. 결과가 없으면 `PROJECT_NOT_FOUND`를 발생시키고 document query를 실행하지 않는다.

- [x] **Step 4: 프로젝트 소속 문서와 권한을 확인한다.**

`whiteboardDocuments.id`와 `whiteboardDocuments.projectId`를 함께 조건으로 문서 `id`, `creatorId`만 조회한다. 결과가 없으면 `WHITEBOARD_DOCUMENT_NOT_FOUND`를 발생시킨다. membership role이 owner가 아니고 document creatorId가 userId와 다르면 `WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN`을 발생시킨다.

- [x] **Step 5: 최소 필드만 update하고 returning한다.**

현재 시각을 한 번 생성해 `name`, `updatedAt`을 설정한다. update 조건은 문서 ID와 project ID를 함께 사용하고, returning projection은 다음 세 필드로 제한한다.

```ts
const now = new Date();

const [updatedWhiteboardDocument] = await tx
  .update(whiteboardDocuments)
  .set({ name, updatedAt: now })
  .where(
    and(
      eq(whiteboardDocuments.id, documentId),
      eq(whiteboardDocuments.projectId, projectId),
    ),
  )
  .returning({
    id: whiteboardDocuments.id,
    name: whiteboardDocuments.name,
    updatedAt: whiteboardDocuments.updatedAt,
  });
```

returning 결과가 비어 있으면 `WHITEBOARD_DOCUMENT_NOT_FOUND`를 발생시킨다. `canvasContent`는 select와 returning 어느 쪽에도 넣지 않는다.

- [x] **Step 6: service 테스트와 기존 화이트보드 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

Expected: service mock 호출 순서, permission, update set/where/returning projection 테스트가 통과하고 아직 controller/route 연결 테스트만 실패한다.

---

### Task 4: controller와 route 연결

**Files:**

- Modify: `backend/src/controllers/whiteboard-document.controller.ts`
- Modify: `backend/src/routes/whiteboard-document.routes.ts`
- Test: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**

- Consumes: Task 2의 schemas와 Task 3의 `updateWhiteboardDocument`
- Produces: 인증된 `PATCH /:documentId` handler

- [x] **Step 1: controller handler를 추가한다.**

`requireUser(req)`로 user ID를 가져온다. `whiteboardDocumentUpdateParamsSchema`로 params를 파싱하고 `updateWhiteboardDocumentSchema`로 body를 파싱한 뒤 다음 입력으로 service를 호출한다.

```ts
const whiteboardDocument = await updateWhiteboardDocument({
  workspaceId,
  projectId,
  documentId,
  userId: user.sub,
  name,
});

res.status(200).json({ whiteboardDocument });
```

- [x] **Step 2: router에 PATCH route를 등록한다.**

기존 `Router({ mergeParams: true })`에 다음 route를 추가한다.

```ts
whiteboardDocumentRouter.patch(
  "/:documentId",
  authenticate,
  asyncHandler(updateWhiteboardDocumentHandler),
);
```

기존 GET/POST route와 index mount는 변경하지 않는다.

- [x] **Step 3: targeted PATCH 테스트를 통과시킨다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

Expected: 화이트보드 문서 생성·목록·수정 테스트가 모두 통과한다.

---

### Task 5: 전체 검증과 구현 결과 기록

**Files:**

- Modify: `docs/superpowers/plans/2026-09-09-whiteboard-document-update-backend-implementation-plan.md`
- Verify: 이번 변경 파일과 관련 backend 전체

- [x] **Step 1: targeted test, 전체 test, lint, build, formatter를 실행한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
git diff --check
```

각 명령의 실제 결과를 이 문서의 `Implementation Results`에 기록한다. formatter가 기존 migration metadata처럼 이번 변경과 무관한 파일에서 실패하면 원인과 범위를 구분해 기록하고, 이번 변경 파일은 별도 확인한다.

- [x] **Step 2: 변경 범위와 API 계약을 최종 확인한다.**

다음을 diff 기준으로 확인한다.

1. PATCH 경로가 정확히 `/:documentId`로 연결되어 있다.
2. transaction이 membership → active project → document → permission → update 순서를 지킨다.
3. update 조건에 `projectId`가 포함되어 다른 project의 문서를 변경하지 않는다.
4. response와 returning projection에 `canvasContent`가 없다.
5. 기존 GET/POST 동작과 테스트가 변하지 않는다.
6. unrelated change와 비밀정보가 포함되지 않는다.

- [x] **Step 3: Implementation Results를 기록한다.**

다음 항목을 한국어로 추가한다.

```markdown
## Implementation Results

### 실제 변경 내용

- 실제 수정한 파일과 API 동작

### 계획과 달라진 점

- 없음 또는 구체적인 차이

### 검증 명령과 결과

- 실행한 명령과 통과/실패 결과

### 남은 후속 작업

- 캔버스 자동 저장·실시간 편집 등 별도 기능
```

- [x] **Step 4: 최종 작업 트리를 확인한다.**

Run:

```bash
git status --short
git diff --stat
git diff --check
```

사용자가 별도로 요청하지 않았으므로 commit, push, merge, PR은 수행하지 않는다.

## Implementation Results

### 실제 변경 내용

- `backend/src/schemas/whiteboard-document.schema.ts`에 수정용 `workspaceId`, `projectId`, `documentId` params schema와 `name` body schema를 추가했다.
- `backend/src/constants/messages.ts`에 문서 ID 검증, 문서 미존재, 수정 권한 오류 메시지를 추가했다.
- `backend/src/services/whiteboard-document.service.ts`에 멤버십·활성 프로젝트·문서 소속·Owner/Creator 권한을 transaction 순서로 확인하는 `updateWhiteboardDocument`를 추가했다.
- service update와 returning projection을 각각 `name`, `updatedAt` 및 `id`, `name`, `updatedAt`으로 제한해 `canvasContent`를 조회·반환하지 않는다.
- `backend/src/controllers/whiteboard-document.controller.ts`와 `backend/src/routes/whiteboard-document.routes.ts`에 인증된 PATCH API를 연결했다.
- `backend/tests/whiteboard-document.test.ts`에 성공·trim·최대 길이·최소 응답·입력·인증·멤버십·프로젝트·문서·권한·DB 오류 테스트와 transaction mock을 추가했다.

### 계획과 달라진 점

- 동작 범위와 API 계약의 차이는 없다.
- 계획보다 PATCH 테스트를 한 파일에 더 상세하게 작성해 호출 순서와 projection까지 검증했다.
- 전체 Prettier 검사는 기존 `backend/src/db/migrations/meta/0000_snapshot.json` 포맷 경고 때문에 실패했으며, 이번 변경 파일만 대상으로 한 Prettier 검사는 통과했다.

### 검증 명령과 결과

- `pnpm --dir backend test -- tests/whiteboard-document.test.ts` (RED): 새 PATCH 테스트 추가 직후 62개 중 기존 41개 통과, 새 테스트 21개 실패로 기능 미구현 상태를 확인했다.
- `pnpm --dir backend test -- tests/whiteboard-document.test.ts` (GREEN): 1개 파일 62개 테스트 통과.
- `pnpm --dir backend test`: 21개 파일 245개 테스트 통과.
- `pnpm --dir backend lint`: 통과.
- `pnpm --dir backend build`: 통과.
- `pnpm --dir backend exec prettier --check src/constants/messages.ts src/schemas/whiteboard-document.schema.ts src/services/whiteboard-document.service.ts src/controllers/whiteboard-document.controller.ts src/routes/whiteboard-document.routes.ts tests/whiteboard-document.test.ts`: 통과.
- `pnpm --dir backend exec prettier --check src tests`: 기존 `src/db/migrations/meta/0000_snapshot.json` 경고로 종료 코드 1. 이번 변경 파일과 무관한 기존 포맷 경고다.
- `git diff --check`: 통과.

### 남은 후속 작업

- 캔버스 `canvasContent` 자동 저장과 실시간 협업 API는 별도 기능으로 구현한다.
- 화이트보드 문서 상세 조회와 삭제 API는 별도 계획으로 다룬다.
- 기존 migration snapshot의 Prettier 경고는 별도 정리 작업으로 남겨둔다.
- 사용자가 요청하지 않아 Git commit·push·merge·PR은 수행하지 않았다.
