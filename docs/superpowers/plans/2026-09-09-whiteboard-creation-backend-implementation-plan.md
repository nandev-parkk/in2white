# 화이트보드 문서 생성 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증된 워크스페이스 멤버가 활성 프로젝트에 이름과 빈 캔버스를 가진 화이트보드 문서를 생성할 수 있는 백엔드 API를 추가한다.

**Architecture:** 기존 `routes → controllers → services → db/schema` MVC 경계를 유지한다. `whiteboard-document` 전용 라우터·컨트롤러·서비스·Zod 스키마를 추가하고, 서비스 트랜잭션 안에서 워크스페이스 멤버십과 활성 프로젝트를 순서대로 확인한 뒤 `whiteboard_documents`를 삽입한다. 기존 DB 스키마의 `canvasContent` 기본값 `{}`를 사용하므로 마이그레이션은 변경하지 않는다.

**Tech Stack:** Node.js 20+, TypeScript, Express, Drizzle ORM, drizzle-zod, Zod, Vitest, Supertest, pnpm

**Spec:** `docs/superpowers/specs/2026-09-09-whiteboard-creation-backend-design.md`

## Global Constraints

- API 경로는 `POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`로 고정한다.
- `workspaceId`와 `projectId`는 UUID여야 한다.
- 이름은 앞뒤 공백을 제거한 뒤 1~50자여야 한다.
- Owner와 Member 모두 생성할 수 있다.
- 비멤버는 `404 WORKSPACE_NOT_FOUND`를 받는다.
- 없거나 다른 워크스페이스에 속하거나 삭제된 프로젝트는 `404 PROJECT_NOT_FOUND`를 받는다.
- 초기 캔버스 콘텐츠는 클라이언트 입력을 받지 않고 DB 기본값 `{}`를 사용한다.
- 기존 `whiteboard_documents` 스키마와 마이그레이션은 수정하지 않는다.
- 사용자 요청이 없으므로 Git commit, push, migration 적용은 수행하지 않는다.

---

### Task 1: 화이트보드 생성 API 회귀 테스트 작성

**Files:**
- Create: `backend/tests/whiteboard-document.test.ts`
- Reference: `backend/tests/project.test.ts`, `backend/src/db/schema/whiteboard-documents.ts`

**Interfaces:**
- Consumes: 아직 구현되지 않은 `POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents` 계약
- Produces: 이후 구현이 만족해야 하는 Supertest/Vitest 회귀 테스트와 Drizzle mock 호출 계약

- [x] **Step 1: 테스트 파일에 DB mock과 생성 fixture를 작성한다**

`project.test.ts`와 같은 패턴으로 `db.transaction`을 mock하고, 멤버십 조회 → 프로젝트 조회 → 문서 insert 순서의 체인을 반환하는 `mockWhiteboardDocumentCreateTransaction` 헬퍼를 만든다. 생성 fixture는 다음 모양을 사용한다.

```ts
const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const createdWhiteboardDocument = {
  id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  projectId,
  name: "아이디어 스케치",
  creatorId: "user-1",
  canvasContent: {},
  createdAt: new Date("2026-09-09T00:00:00.000Z"),
  updatedAt: new Date("2026-09-09T00:00:00.000Z"),
};
```

멤버십 query는 `.from().where()`를 제공하고, 프로젝트 query도 `.from().where()`를 제공한다. insert chain은 `.values().returning()`을 제공한다. 각 helper 입력에서 `membershipRows`, `projectRows`, `membershipError`, `projectError`, `insertError`를 바꿀 수 있게 한다.

- [x] **Step 2: 성공·권한·입력·상위 리소스·DB 오류 테스트를 작성한다**

다음 테스트를 `describe("POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents", ...)` 안에 추가한다.

```ts
it("creates a whiteboard document for a workspace member and returns 201", async () => {
  const { membershipQuery, projectQuery, documentInsert, transaction } =
    mockWhiteboardDocumentCreateTransaction();

  const response = await request(createApp())
    .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
    .set("Authorization", `Bearer ${await createAccessToken()}`)
    .send({ name: "  아이디어 스케치  " });

  expect(response.status).toBe(201);
  expect(response.body.whiteboardDocument).toEqual({
    ...createdWhiteboardDocument,
    createdAt: createdWhiteboardDocument.createdAt.toISOString(),
    updatedAt: createdWhiteboardDocument.updatedAt.toISOString(),
  });
  expect(db.transaction).toHaveBeenCalledOnce();
  expect(transaction.select).toHaveBeenNthCalledWith(1, { id: workspaceMemberships.id });
  expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
  expect(membershipQuery.where).toHaveBeenCalledWith(
    and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      eq(workspaceMemberships.userId, "user-1"),
    ),
  );
  expect(transaction.select).toHaveBeenNthCalledWith(2, { id: projects.id });
  expect(projectQuery.from).toHaveBeenCalledWith(projects);
  expect(projectQuery.where).toHaveBeenCalledWith(
    and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)),
  );
  expect(transaction.insert).toHaveBeenCalledWith(whiteboardDocuments);
  expect(documentInsert.values).toHaveBeenCalledWith({
    projectId,
    name: "아이디어 스케치",
    creatorId: "user-1",
  });
});
```

추가로 Owner/Member 각각의 생성 성공, 인증 없는 요청 401, 이름 누락·공백·51자 및 잘못된 UUID 400, 비멤버 404 `WORKSPACE_NOT_FOUND`, 프로젝트 없음·다른 워크스페이스·삭제 프로젝트 404 `PROJECT_NOT_FOUND`, 멤버십/프로젝트 조회/insert 오류 500을 검증한다. 비멤버와 프로젝트 오류 케이스에서는 문서 insert가 호출되지 않았음을 검증한다.

- [x] **Step 3: 실패를 확인한다**

실행:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

예상 결과: 새 라우트와 모듈이 아직 없어 요청이 404이거나 import/라우트 관련 실패가 발생한다. 이 단계에서는 실패가 정상이다.

---

### Task 2: 입력 스키마와 오류 메시지 구현

**Files:**
- Create: `backend/src/schemas/whiteboard-document.schema.ts`
- Modify: `backend/src/constants/messages.ts`
- Test: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**
- Consumes: `ERROR_MESSAGES.PROJECT_ID_INVALID`, `ERROR_MESSAGES.WORKSPACE_ID_INVALID`, `parseOrThrow`
- Produces: `whiteboardDocumentParamsSchema`, `createWhiteboardDocumentSchema`, 문서 이름 검증 메시지

- [x] **Step 1: 이름 검증 테스트가 검증 오류를 구분하도록 확인한다**

테스트에서 잘못된 이름 요청의 응답 코드가 `VALIDATION_ERROR`인지, 기존 UUID 검증도 같은 코드인지 확인한다. 정상 길이 경계인 50자는 통과하고 51자는 실패하도록 테스트한다.

- [x] **Step 2: 오류 메시지를 추가한다**

`ERROR_MESSAGES`에 다음 두 항목을 추가한다.

```ts
WHITEBOARD_DOCUMENT_NAME_REQUIRED: "화이트보드 문서 이름을 입력해주세요",
WHITEBOARD_DOCUMENT_NAME_TOO_LONG: "화이트보드 문서 이름은 50자 이내로 입력해주세요",
```

- [x] **Step 3: Zod 스키마를 구현한다**

새 파일에 다음 계약을 구현한다.

```ts
import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

const whiteboardDocumentNameSchema = z
  .string({ error: ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NAME_REQUIRED })
  .trim()
  .min(1, ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NAME_REQUIRED)
  .max(50, ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NAME_TOO_LONG);

export const whiteboardDocumentParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }),
});

export const createWhiteboardDocumentSchema = z.object({
  name: whiteboardDocumentNameSchema,
});
```

Zod의 `.trim()` 결과를 컨트롤러가 서비스로 전달해 저장값이 정규화되도록 한다. 캔버스 콘텐츠를 받는 필드는 정의하지 않는다.

- [x] **Step 4: 스키마만 통과하는 테스트를 실행한다**

실행:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

예상 결과: 입력 검증 테스트는 통과하거나 라우트/서비스 미구현으로 인한 나머지 실패만 남는다.

---

### Task 3: 서비스·컨트롤러·라우터 구현

**Files:**
- Create: `backend/src/services/whiteboard-document.service.ts`
- Create: `backend/src/controllers/whiteboard-document.controller.ts`
- Create: `backend/src/routes/whiteboard-document.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Test: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**
- Consumes: `whiteboardDocumentParamsSchema`, `createWhiteboardDocumentSchema`, `requireUser`, 기존 `authenticate`와 `asyncHandler`
- Produces: `createWhiteboardDocument(input)`과 `POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`

- [x] **Step 1: 서비스 계약을 테스트 fixture와 맞춘다**

서비스 입력과 반환 타입을 다음처럼 정의한다.

```ts
export interface CreateWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  name: string;
  creatorId: string;
}

export async function createWhiteboardDocument(
  input: CreateWhiteboardDocumentInput,
): Promise<typeof whiteboardDocuments.$inferSelect>;
```

- [x] **Step 2: 트랜잭션 기반 생성 서비스를 구현한다**

`db.transaction` 안에서 먼저 멤버십을 조회한다.

```ts
const [membership] = await tx
  .select({ id: workspaceMemberships.id })
  .from(workspaceMemberships)
  .where(
    and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      eq(workspaceMemberships.userId, creatorId),
    ),
  );

if (!membership) {
  throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
}
```

멤버십이 확인되면 활성 프로젝트를 조회한다.

```ts
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
  throw new HttpError(404, "PROJECT_NOT_FOUND", ERROR_MESSAGES.PROJECT_NOT_FOUND);
}
```

그 후 `whiteboardDocuments`에 `projectId`, `name`, `creatorId`만 전달하고 `.returning()` 결과를 반환한다. 행이 없으면 `new Error("Whiteboard document insert returned no row")`를 발생시킨다. `canvasContent`는 삽입값에 포함하지 않아 DB 기본값을 사용한다.

- [x] **Step 3: 컨트롤러를 구현한다**

컨트롤러는 인증 사용자 → 경로 검증 → 본문 검증 → 서비스 호출 순서를 지킨다.

```ts
export async function createWhiteboardDocumentHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId } = parseOrThrow(whiteboardDocumentParamsSchema, req.params);
  const { name } = parseOrThrow(createWhiteboardDocumentSchema, req.body);

  const whiteboardDocument = await createWhiteboardDocument({
    workspaceId,
    projectId,
    name,
    creatorId: user.sub,
  });

  res.status(201).json({ whiteboardDocument });
}
```

- [x] **Step 4: 라우터를 구현하고 앱에 마운트한다**

컨트롤러가 마운트 경로의 `workspaceId`와 `projectId`를 읽어야 하므로 라우터는 `mergeParams: true`로 만든다.

```ts
export const whiteboardDocumentRouter = Router({ mergeParams: true });

whiteboardDocumentRouter.post(
  "/",
  authenticate,
  asyncHandler(createWhiteboardDocumentHandler),
);
```

`routes/index.ts`에 다음 import와 mount를 추가한다.

```ts
import { whiteboardDocumentRouter } from "@/routes/whiteboard-document.routes";

router.use(
  "/workspaces/:workspaceId/projects/:projectId/whiteboard-documents",
  whiteboardDocumentRouter,
);
```

- [x] **Step 5: 기능 테스트를 실행해 Green을 확인한다**

실행:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

예상 결과: 화이트보드 문서 생성 테스트 전체 PASS.

---

### Task 4: 리팩터링과 전체 검증

**Files:**
- Modify: `docs/superpowers/plans/2026-09-09-whiteboard-creation-backend-implementation-plan.md`
- Modify: `backend/src/**` 및 `backend/tests/whiteboard-document.test.ts` (검증 중 필요한 포맷·타입 수정만)

**Interfaces:**
- Consumes: Task 1~3의 구현과 테스트
- Produces: 포맷·타입·전체 회귀 검증 결과와 `Implementation Results` 기록

- [x] **Step 1: 대상 테스트와 전체 테스트를 실행한다**

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
pnpm --dir backend test
```

예상 결과: 대상 테스트와 기존 전체 테스트가 모두 PASS.

- [x] **Step 2: 정적 검증을 실행한다**

```bash
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
```

예상 결과: lint 오류 없음, TypeScript build 성공, Prettier check 통과.

- [x] **Step 3: 변경 범위를 확인한다**

```bash
git diff --check
git status --short
git diff --stat
```

화이트보드 생성 관련 파일과 설계·계획 문서만 변경되었는지 확인한다. 기존 사용자 변경사항을 되돌리거나 커밋하지 않는다.

- [x] **Step 4: 계획 문서에 Implementation Results를 기록한다**

계획 문서 하단에 다음 항목을 실제 값으로 채워 추가한다.

```markdown
## Implementation Results

### 실제 변경 내용

- ...

### 계획과 달라진 점

- 없음 또는 구체적인 차이

### 실행한 검증 명령과 결과

- `...`: PASS/실패 원인

### 남은 후속 작업

- 실시간 협업·자동 저장·문서 목록 등 별도 기능
```

계획·설계와 실제 코드의 차이가 있으면 구현 완료 전에 이 절을 갱신한다.

## Implementation Results

### 실제 변경 내용

- `POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents` API를 추가했다.
- UUID 경로 파라미터와 화이트보드 문서 이름(Trim 후 1~50자)을 Zod로 검증한다.
- 서비스 트랜잭션에서 워크스페이스 멤버십과 활성 프로젝트를 순서대로 확인하고 문서를 생성한다.
- 문서 생성 시 `projectId`, 정규화된 `name`, 인증 사용자의 `creatorId`만 삽입해 `canvasContent: {}`와 시각 기본값을 DB에 위임한다.
- Owner/Member, 인증·입력 오류, 비멤버·프로젝트 상태 오류, DB 오류를 검증하는 API 테스트 21개를 추가했다.
- 설계 문서의 상태를 구현 완료로 갱신했다.

### 계획과 달라진 점

- 구현 중 중첩 라우터가 부모 경로 파라미터를 읽도록 `Router({ mergeParams: true })`를 계획에 반영했다.
- 계획에 명시한 기본 예외 외에 이름의 비문자열 입력과 insert가 행을 반환하지 않는 경우의 회귀 테스트를 추가했다.
- 스키마 단독 단계의 검증은 모듈 연결 후 대상 API 테스트로 함께 확인했다.

### 실행한 검증 명령과 결과

- `pnpm --dir backend test`: PASS — 21개 파일, 204개 테스트
- `pnpm --dir backend test -- tests/whiteboard-document.test.ts`: PASS — 21개 테스트
- `pnpm --dir backend lint`: PASS
- `pnpm --dir backend build`: PASS
- 변경 파일 대상 `pnpm --dir backend exec prettier --check ...`: PASS
- `git diff --check`: PASS
- 전체 `pnpm --dir backend exec prettier --check src tests`: 기존 `src/db/migrations/meta/0000_snapshot.json` 포맷 경고로 실패. 해당 파일은 이번 작업과 무관해 수정하지 않았다.

### 남은 후속 작업

- 화이트보드 문서 목록·상세·수정·삭제 API
- Excalidraw 실시간 동기화와 자동 저장
- 기존 migration snapshot의 별도 Prettier 정리
