# 화이트보드 문서 상세 조회 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증된 workspace 멤버가 활성 프로젝트의 활성 화이트보드 문서를 `canvasContent`와 함께 단건 조회할 수 있는 GET API를 추가한다.

**Architecture:** 기존 `routes → controllers → services → db/schema` 경계를 유지한다. 목록 조회의 메타데이터 전용 projection은 변경하지 않고, `GET /:documentId` 전용 service가 멤버십·활성 프로젝트·활성 문서를 순서대로 검증한 뒤 명시적인 상세 projection을 반환한다.

**Tech Stack:** Express, TypeScript, Drizzle ORM, Zod, Vitest, Supertest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-10-whiteboard-document-detail-read-design.md`

## Global Constraints

- 목록 조회에는 `canvasContent`를 추가하지 않는다.
- 상세 조회 응답에는 `id`, `projectId`, `name`, `creatorId`, `canvasContent`, `createdAt`, `updatedAt`만 포함하고 `deletedAt`은 노출하지 않는다.
- workspace 멤버십 → 활성 project → 활성 document 순서로 검증하며, 삭제 문서는 `404 WHITEBOARD_DOCUMENT_NOT_FOUND`로 처리한다.
- 기존 인증 middleware, params schema, error handler, 응답 envelope `{ whiteboardDocument }`를 재사용한다.
- `canvasContent` 수정, 복구·hard delete, frontend, migration은 이번 범위에 포함하지 않는다.
- 사용자가 명시적으로 요청하기 전까지 commit·push·merge·PR을 실행하지 않는다.

---

### Task 1: 상세 조회 실패 테스트와 query mock 추가

**Files:**
- Modify: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**
- Consumes: 기존 `createApp()`, `createAccessToken()`, `db.select` mock, `whiteboardDocuments` schema export
- Produces: 상세 조회 endpoint의 성공·인증·파라미터·리소스 경계·DB 실패를 검증하는 실패 테스트와 `mockWhiteboardDocumentDetailQueries()` 테스트 helper

- [x] **Step 1: 상세 조회 query mock helper를 추가한다.**

멤버십, project, document query를 순서대로 반환하고 각 단계의 rows/error를 주입할 수 있는 helper를 추가한다. document row에는 `canvasContent`와 `deletedAt: null`을 포함해 실제 DB row가 내부 soft-delete 컬럼을 갖는 상황을 표현한다.

```ts
function mockWhiteboardDocumentDetailQueries({
  membershipRows = [{ id: "membership-1" }],
  projectRows = [{ id: projectId }],
  documentRows = [createdWhiteboardDocumentRow],
  membershipError,
  projectError,
  documentError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  documentRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  documentError?: Error;
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

  vi.mocked(db.select)
    .mockReturnValueOnce(membershipQuery as never)
    .mockReturnValueOnce(projectQuery as never)
    .mockReturnValueOnce(documentQuery as never);

  return { membershipQuery, projectQuery, documentQuery };
}
```

helper는 구현 코드가 아니라 테스트 격리용 mock만 제공한다.

- [x] **Step 2: 성공 응답 테스트를 작성한다.**

다음 요청을 작성한다.

```ts
const response = await request(createApp())
  .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents/${createdWhiteboardDocument.id}`)
  .set("Authorization", `Bearer ${await createAccessToken()}`);
```

route가 아직 없으므로 RED 단계에서 `404`가 발생해야 한다. 테스트는 다음을 기대한다.

```ts
expect(response.status).toBe(200);
expect(response.body.whiteboardDocument).toEqual({
  id: createdWhiteboardDocument.id,
  projectId,
  name: createdWhiteboardDocument.name,
  creatorId: createdWhiteboardDocument.creatorId,
  canvasContent: createdWhiteboardDocument.canvasContent,
  createdAt: createdWhiteboardDocument.createdAt.toISOString(),
  updatedAt: createdWhiteboardDocument.updatedAt.toISOString(),
});
expect(response.body.whiteboardDocument).not.toHaveProperty("deletedAt");
```

- [x] **Step 3: 접근 제어와 오류 경계 테스트를 작성한다.**

다음 동작을 각각 검증한다.

| 케이스 | 기대 상태·코드 | 기대 query 경계 |
|---|---|---|
| Authorization 없음 | `401 UNAUTHORIZED` | `db.select` 미호출 |
| workspace/project/document UUID 오류 | `400 VALIDATION_ERROR` | `db.select` 미호출 |
| 멤버십 없음 | `404 WORKSPACE_NOT_FOUND` | project/document query 미호출 |
| project 없음·다른 workspace·삭제 project | `404 PROJECT_NOT_FOUND` | document query 미호출 |
| document 없음·다른 project·삭제 document | `404 WHITEBOARD_DOCUMENT_NOT_FOUND` | document query까지만 실행 |
| membership/project/document query 오류 | `500 INTERNAL_SERVER_ERROR` | 실패한 query까지만 실행 |

삭제 document 행은 `documentRows: []`로 표현하고, 성공 테스트의 상세 projection expectation은 `canvasContent`를 포함하되 `deletedAt`은 제외하도록 작성한다.

- [x] **Step 4: RED 결과를 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts --reporter=dot
```

Expected: 기존 테스트는 통과하지만 새 상세 조회 테스트는 route가 구현되지 않아 실패한다. 실패 원인이 테스트 오타가 아니라 미구현 GET endpoint인지 확인한다.

### Task 2: 상세 조회 service·controller·route 구현

**Files:**
- Modify: `backend/src/services/whiteboard-document.service.ts`
- Modify: `backend/src/controllers/whiteboard-document.controller.ts`
- Modify: `backend/src/routes/whiteboard-document.routes.ts`

**Interfaces:**
- Consumes: Task 1의 상세 조회 response/error 테스트와 기존 params/auth/error 패턴
- Produces: `getWhiteboardDocument(input): Promise<WhiteboardDocumentDetail>` service와 인증된 `GET /:documentId` route

- [x] **Step 1: 상세 조회 반환 타입과 service를 추가한다.**

다음 입력과 반환 projection을 사용한다.

```ts
export interface GetWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  documentId: string;
  userId: string;
}

export type WhiteboardDocumentDetail = Pick<
  typeof whiteboardDocuments.$inferSelect,
  "id" | "projectId" | "name" | "creatorId" | "canvasContent" | "createdAt" | "updatedAt"
>;
```

`getWhiteboardDocument`는 `db.select`를 사용해 다음 순서로 조회한다.

```ts
const [membership] = await db
  .select({ id: workspaceMemberships.id })
  .from(workspaceMemberships)
  .where(and(
    eq(workspaceMemberships.workspaceId, workspaceId),
    eq(workspaceMemberships.userId, userId),
  ));

// membership가 없으면 WORKSPACE_NOT_FOUND
// 이어서 workspaceId와 deletedAt IS NULL을 포함한 project 조회
// 이어서 projectId와 deletedAt IS NULL을 포함한 document 조회
```

document select는 다음 필드만 반환한다.

```ts
{
  id: whiteboardDocuments.id,
  projectId: whiteboardDocuments.projectId,
  name: whiteboardDocuments.name,
  creatorId: whiteboardDocuments.creatorId,
  canvasContent: whiteboardDocuments.canvasContent,
  createdAt: whiteboardDocuments.createdAt,
  updatedAt: whiteboardDocuments.updatedAt,
}
```

document row가 없으면 `WHITEBOARD_DOCUMENT_NOT_FOUND`를 던진다. `deletedAt` 조건은 document select에 포함해 삭제 문서를 일반 미존재와 동일하게 처리한다.

- [x] **Step 2: controller handler를 추가한다.**

`requireUser(req)`와 기존 `whiteboardDocumentUpdateParamsSchema`를 사용해 `workspaceId`, `projectId`, `documentId`를 파싱한 뒤 service를 호출한다.

```ts
export async function getWhiteboardDocumentHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId, documentId } = parseOrThrow(
    whiteboardDocumentUpdateParamsSchema,
    req.params,
  );

  const whiteboardDocument = await getWhiteboardDocument({
    workspaceId,
    projectId,
    documentId,
    userId: user.sub,
  });

  res.status(200).json({ whiteboardDocument });
}
```

- [x] **Step 3: 인증 GET route를 등록한다.**

기존 route 선언 순서와 middleware 패턴을 유지한다.

```ts
whiteboardDocumentRouter.get(
  "/:documentId",
  authenticate,
  asyncHandler(getWhiteboardDocumentHandler),
);
```

목록 `GET "/"`, 생성 `POST "/"`, 이름 변경 `PATCH`, 삭제 `DELETE`의 계약은 변경하지 않는다.

- [x] **Step 4: 집중 테스트로 GREEN을 확인한다.**

Run:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts --reporter=dot
```

Expected: 상세 조회 테스트와 기존 화이트보드 문서 테스트가 모두 통과한다.

### Task 3: 전체 검증과 결과 문서화

**Files:**
- Modify: `docs/superpowers/plans/2026-09-10-whiteboard-document-detail-read-implementation-plan.md`

**Interfaces:**
- Consumes: Task 2의 구현과 GREEN 테스트 결과
- Produces: 실제 변경·계획 차이·검증 결과·후속 작업이 기록된 `Implementation Results`

- [x] **Step 1: 관련 검증을 실행한다.**

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts --reporter=dot
pnpm --dir backend test -- --reporter=dot
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src/controllers/whiteboard-document.controller.ts src/routes/whiteboard-document.routes.ts src/services/whiteboard-document.service.ts tests/whiteboard-document.test.ts
git diff --check
```

각 명령의 exit code와 테스트 파일·테스트 수를 기록한다. broad `prettier --check src tests`가 기존 생성 metadata 문제로 실패하면 변경 source/test focused 결과와 구분해 기록한다.

- [x] **Step 2: 변경 범위와 API 계약을 검토한다.**

다음을 확인한다.

- 목록 query projection에 `canvasContent`가 추가되지 않았다.
- 상세 response에 `deletedAt`이 포함되지 않는다.
- 인증 → membership → active project → active document 검증 순서가 유지된다.
- migration·frontend·canvasContent 수정 API가 추가되지 않았다.

- [x] **Step 3: 계획 문서에 `Implementation Results`를 추가한다.**

다음 형식으로 실제 결과를 기록한다.

```markdown
## Implementation Results

### 실제 변경 내용

- 추가·수정한 route, controller, service, test를 기록한다.

### 계획과 달라진 점

- 계획과 동일한지, 차이가 있다면 이유와 영향 범위를 기록한다.

### 실행한 검증 명령과 결과

- 실행한 명령과 exit code, 테스트 수를 기록한다.

### 남은 후속 작업

- frontend editor 연동 또는 canvasContent 수정 API가 필요한 경우 별도 작업으로 기록한다.
```

## Implementation Results

### 실제 변경 내용

- `backend/src/routes/whiteboard-document.routes.ts`: 기존 인증 middleware와 async handler 패턴으로 `GET /:documentId` 상세 조회 route를 추가했다.
- `backend/src/controllers/whiteboard-document.controller.ts`: 인증 사용자와 기존 params schema를 사용해 입력을 검증하고 `{ whiteboardDocument }` 응답을 반환하는 handler를 추가했다.
- `backend/src/services/whiteboard-document.service.ts`: `GetWhiteboardDocumentInput`, `WhiteboardDocumentDetail`, `getWhiteboardDocument`를 추가했다. workspace membership, 활성 project, 활성 document를 순서대로 확인하고 상세 필드만 명시적으로 조회한다.
- `backend/tests/whiteboard-document.test.ts`: 상세 query mock과 성공, 인증, UUID 검증, 리소스 경계, query 오류 테스트를 추가했다.
- 문서 산출물은 본 계획 문서와 `docs/superpowers/specs/2026-09-10-whiteboard-document-detail-read-design.md`이며, production 변경 파일은 위 backend 3개 파일, 테스트 변경 파일은 1개다.

### 계획과 달라진 점

- 구현 범위와 API 계약은 승인된 계획과 동일하며 기능상 차이는 없다.
- 목록 query projection은 변경되지 않아 `canvasContent`가 추가되지 않았고, 상세 projection과 반환값은 `deletedAt`을 제외한다.
- 인증 route middleware 이후 service에서 membership → `deletedAt IS NULL`인 project → `deletedAt IS NULL`인 document 순서를 유지한다.
- migration, frontend, `canvasContent` 수정 API는 추가하지 않았다.

### 실행한 검증 명령과 결과

- `pnpm --dir backend test -- tests/whiteboard-document.test.ts --reporter=dot`: exit code 0, 테스트 파일 1개 통과, 테스트 93개 통과.
- `pnpm --dir backend test -- --reporter=dot`: exit code 0, 테스트 파일 21개 통과, 테스트 277개 통과.
- `pnpm --dir backend lint`: exit code 0.
- `pnpm --dir backend build`: exit code 0.
- `pnpm --dir backend exec prettier --check src/controllers/whiteboard-document.controller.ts src/routes/whiteboard-document.routes.ts src/services/whiteboard-document.service.ts tests/whiteboard-document.test.ts`: exit code 0, 지정한 source/test 4개 파일의 formatting 통과.
- `git diff --check`: exit code 0.
- broad `prettier --check src tests`는 브리프의 필수 명령이 아니어서 실행하지 않았다. 따라서 기존/generated metadata 관련 broad formatting 실패는 관찰되지 않았으며, 위 focused source/test formatting 결과와 별도로 기록할 항목이 없다.

### 남은 후속 작업

- frontend editor에서 상세 조회 API를 연동하는 작업은 별도 범위로 남긴다.
- `canvasContent` 수정 API가 필요하면 별도 설계·구현 작업으로 진행한다.
- 이번 작업에서는 commit, push, PR을 생성하지 않았다.
