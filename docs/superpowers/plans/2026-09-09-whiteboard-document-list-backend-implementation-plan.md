# 화이트보드 문서 목록 조회 백엔드 구현 계획

> **에이전트 작업자용:** 이 계획은 `superpowers:test-driven-development` 순서로 실행한다. 각 단계는 체크박스로 추적하고 production code보다 실패 테스트를 먼저 작성한다.

**목표:** 인증된 워크스페이스 멤버가 활성 프로젝트의 화이트보드 문서 메타데이터를 검색·페이지네이션으로 조회할 수 있는 백엔드 API를 추가한다.

**아키텍처:** 기존 `routes → controllers → services → db/schema` 경계를 유지한다. 기존 화이트보드 문서 서비스·컨트롤러·라우터에 목록 유스케이스를 추가하고, 공통 query schema·pagination·search 유틸리티를 재사용한다. 서비스는 멤버십과 활성 프로젝트를 순서대로 확인한 뒤 count와 creator join rows query를 병렬 실행한다.

**기술 스택:** Node.js 20+, TypeScript, Express, Drizzle ORM, Zod, Vitest, Supertest, pnpm

**설계 문서:** [`docs/superpowers/specs/2026-09-09-whiteboard-document-list-backend-design.md`](../specs/2026-09-09-whiteboard-document-list-backend-design.md)

## 전역 제약

- API 경로는 `GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`로 고정한다.
- `workspaceId`와 `projectId`는 UUID여야 하며, query는 기존 `listQuerySchema` 계약을 재사용한다.
- search는 문서명에 대한 대소문자 구분 없는 literal contains 검색이며 `%`, `_`, `\\`를 wildcard로 해석하지 않는다.
- 기본 page는 1, 기본 limit은 20, limit 최대값은 100이다.
- Owner와 Member 모두 조회할 수 있고, 비멤버는 `404 WORKSPACE_NOT_FOUND`를 받는다.
- 없거나 다른 워크스페이스에 속하거나 삭제된 프로젝트는 `404 PROJECT_NOT_FOUND`를 받는다.
- 목록 항목은 문서 메타데이터와 creator만 반환하며 `canvasContent`를 반환하거나 select하지 않는다.
- 정렬은 `updatedAt DESC`, `createdAt DESC`, `id ASC`로 고정한다.
- 기존 DB 스키마·migration·공통 query/pagination/search 모듈은 수정하지 않는다.
- 사용자 요청이 없으므로 Git commit, push, merge, PR은 수행하지 않는다.

---

### Task 1: 목록 API 회귀 테스트와 DB mock 작성

**Files:**

- Modify: `backend/tests/whiteboard-document.test.ts`
- Reference: `backend/tests/project.test.ts`, `backend/src/services/project.service.ts`

**Interfaces:**

- Consumes: 아직 구현되지 않은 GET 목록 계약
- Produces: Supertest/Vitest 회귀 테스트와 Drizzle query 호출 계약

- [x] **Step 1: 목록 query fixture와 mock chain을 추가한다.**

기존 `db.transaction` mock에 `db.select`를 추가하고, 각 테스트 전에 두 mock을 초기화한다. membership query, project query, count query, rows query를 순서대로 반환하는 `mockWhiteboardDocumentListQueries` helper를 만든다. count chain은 `.from().where()`를, rows chain은 `.from().innerJoin().where().orderBy().limit().offset()`을 제공한다. membership/project/count/rows 각각의 오류와 반환 행을 helper 입력으로 제어한다.

문서 fixture는 `id`, `projectId`, `name`, `creatorId`, `createdAt`, `updatedAt`와 creator `{ id, name }`를 포함한다. rows fixture에는 의도적으로 `canvasContent`를 넣어도 서비스 select projection과 HTTP 응답에 노출되지 않는지 검증할 수 있게 한다.

- [x] **Step 2: 성공·검색·페이지네이션·projection 테스트를 먼저 작성한다.**

`GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`에 대해 다음을 검증한다.

1. 기본 query로 200과 `{ whiteboardDocuments, pagination }`를 반환하고 creator metadata, ISO date, 기본 page/limit/total/totalPages를 포함한다.
2. Owner와 Member가 모두 조회할 수 있다.
3. `search`가 trim된 값으로 count와 rows 양쪽의 동일한 `ilike(whiteboardDocuments.name, buildContainsSearchPattern(search))` 조건에 사용된다.
4. `%`, `_`, `\\`가 escaped pattern으로 전달된다.
5. `page`, `limit`이 order, limit, offset에 반영되고 `updatedAt DESC`, `createdAt DESC`, `id ASC` 순서가 전달된다.
6. 응답 문서와 `db.select` rows projection 어느 쪽에도 `canvasContent`가 포함되지 않는다.
7. 검색 결과가 없거나 page가 범위를 벗어나면 200과 빈 배열을 반환하고 totalPages를 계산한다.

- [x] **Step 3: 인증·입력·권한·DB 오류 테스트를 작성한다.**

인증 헤더 없음은 401, 잘못된 UUID·search 길이·page·limit은 400이며 해당 입력 오류는 DB를 호출하지 않는지 검증한다. 비멤버는 404 `WORKSPACE_NOT_FOUND`이고 project/count/rows query를 실행하지 않아야 한다. missing/cross-workspace/deleted project는 404 `PROJECT_NOT_FOUND`이고 count/rows query를 실행하지 않아야 한다. membership, project, count, rows query 오류는 각각 500 응답이 되는지 검증한다.

- [x] **Step 4: 테스트가 구현 누락으로 실패하는지 확인한다.**

실행:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

예상 결과: GET 라우트와 목록 서비스가 없으므로 새 목록 테스트가 실패한다. 기존 화이트보드 생성 테스트의 통과 여부도 함께 확인한다.

---

### Task 2: 목록 서비스 구현

**Files:**

- Modify: `backend/src/services/whiteboard-document.service.ts`
- Test: `backend/tests/whiteboard-document.test.ts`
- Reference: `backend/src/services/project.service.ts`, `backend/src/utils/pagination.ts`, `backend/src/utils/search.ts`

**Interfaces:**

- Produces `ListWhiteboardDocumentsInput`, `WhiteboardDocumentListItem`, `ListWhiteboardDocumentsResult`
- Produces `listWhiteboardDocuments(input): Promise<ListWhiteboardDocumentsResult>`

- [x] **Step 1: 목록 입력·항목·결과 타입을 정의한다.**

입력은 `workspaceId`, `projectId`, `userId`, `search?`, `page`, `limit`을 가진다. 항목은 `id`, `projectId`, `name`, `creatorId`, `creator: { id, name }`, `createdAt`, `updatedAt`만 가진다. 결과는 `whiteboardDocuments`와 공통 `PaginationMeta`를 가진다.

- [x] **Step 2: 멤버십과 활성 프로젝트를 순서대로 확인한다.**

`workspaceMemberships`에서 workspace/user를 확인하고 없으면 `HttpError(404, "WORKSPACE_NOT_FOUND", ...)`를 발생시킨다. 통과하면 `projects.id`, `projects.workspaceId`, `projects.deletedAt IS NULL` 조건으로 project를 확인하고 없으면 `HttpError(404, "PROJECT_NOT_FOUND", ...)`를 발생시킨다.

- [x] **Step 3: count와 rows query를 같은 조건으로 구현한다.**

문서 조건은 `eq(whiteboardDocuments.projectId, projectId)`와 선택적 `ilike(whiteboardDocuments.name, buildContainsSearchPattern(search))`의 `and` 조합으로 만든다. `Promise.all`로 count query와 users inner join rows query를 실행한다. rows select에는 문서 metadata와 creator id/name만 명시하고 `canvasContent`는 포함하지 않는다. order, limit, offset은 공통 pagination 규칙을 적용한다.

- [x] **Step 4: pagination metadata를 반환하고 서비스 테스트를 통과시킨다.**

count 결과를 숫자로 변환하고 `createPaginationMeta({ page, limit, total })`를 사용한다. rows와 metadata를 반환한 뒤 다음을 실행한다.

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

예상 결과: 서비스와 기존 생성 API 테스트가 통과한다.

---

### Task 3: 컨트롤러·라우터 연결

**Files:**

- Modify: `backend/src/controllers/whiteboard-document.controller.ts`
- Modify: `backend/src/routes/whiteboard-document.routes.ts`
- Test: `backend/tests/whiteboard-document.test.ts`

**Interfaces:**

- Produces `listWhiteboardDocumentsHandler`
- Produces 인증된 `GET /` whiteboard document route

- [x] **Step 1: 컨트롤러를 구현한다.**

`requireUser(req)`로 사용자 ID를 얻고 `whiteboardDocumentParamsSchema`로 params를 파싱한 뒤 `listQuerySchema`로 query를 파싱한다. 파싱 결과를 `listWhiteboardDocuments`에 전달하고 200으로 결과 envelope를 반환한다. create handler의 인증·오류 처리 패턴을 유지한다.

- [x] **Step 2: 라우터에 GET route를 추가한다.**

기존 `Router({ mergeParams: true })`에 `authenticate`와 `asyncHandler`를 적용한 `GET /` route를 POST route와 함께 등록한다. index route mount와 기존 POST 동작은 변경하지 않는다.

- [x] **Step 3: targeted API 테스트를 통과시킨다.**

실행:

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
```

예상 결과: 생성과 목록의 전체 화이트보드 문서 테스트가 통과한다.

---

### Task 4: 전체 검증과 문서 결과 기록

**Files:**

- Modify: `docs/superpowers/plans/2026-09-09-whiteboard-document-list-backend-implementation-plan.md`
- Modify: `docs/superpowers/specs/2026-09-09-whiteboard-document-list-backend-design.md`
- Verify: 구현 파일과 테스트 파일

- [x] **Step 1: targeted test, 전체 test, lint, build, formatter를 실행한다.**

다음 명령을 순서대로 실행하고 각 결과를 기록한다.

```bash
pnpm --dir backend test -- tests/whiteboard-document.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
```

실패가 있으면 원인을 수정하고 해당 명령부터 다시 실행한다. 기존 migration snapshot의 formatter 경고처럼 이번 변경과 무관한 결과는 범위를 구분해 기록한다.

- [x] **Step 2: 코드 리뷰와 계획 대비 구현을 확인한다.**

설계 문서·계획 문서·변경 diff를 기준으로 API 경로, 응답 envelope, 권한 오류, 검색 escape, projection, deterministic order가 일치하는지 확인한다. 리뷰에서 발견한 실제 문제를 수정한 뒤 전체 검증을 다시 실행한다.

- [x] **Step 3: Implementation Results를 기록한다.**

계획 문서에 실제 변경 파일과 동작, 계획과 달라진 점, 실행한 검증 명령과 결과, 남은 후속 작업을 한국어로 기록한다. 설계 문서 상태를 구현 및 최종 검토 완료로 갱신한다.

- [x] **Step 4: 작업 트리와 변경 범위를 최종 확인한다.**

`git diff --check`, `git status --short`, `git diff --stat`로 whitespace 오류와 unrelated change가 없는지 확인한다. 사용자가 명시적으로 요청하지 않았으므로 commit/push/PR은 실행하지 않는다.

## Implementation Results

### 실제 변경 내용

- `whiteboardDocument.service.ts`에 멤버십·활성 프로젝트 확인, 문서명 검색, creator join, count/rows 병렬 조회, 결정적 정렬과 pagination metadata를 추가했다.
- `whiteboardDocument.controller.ts`와 `whiteboardDocument.routes.ts`에 인증된 GET 목록 API를 연결했다.
- `whiteboard-document.test.ts`에 성공·검색·wildcard escape·페이지네이션·projection·인증·입력·권한·DB 오류 회귀 테스트를 추가했다.
- 설계 문서의 실제 라우터·params schema 참조를 구현과 일치하도록 정정했다.

### 계획과 달라진 점

- 없음. 기존 공통 query/pagination/search 모듈과 DB schema/migration은 계획대로 변경하지 않았다.

### 검증 명령과 결과

- `pnpm --dir backend test -- tests/whiteboard-document.test.ts`: 통과, 1개 파일 41개 테스트.
- `pnpm --dir backend test`: 통과, 21개 파일 224개 테스트.
- `pnpm --dir backend lint`: 통과.
- `pnpm --dir backend build`: 통과.
- `pnpm --dir backend exec prettier --check src tests`: 기존 `src/db/migrations/meta/0000_snapshot.json` 포맷 경고로 종료 코드 1. 이번 변경 파일만 별도로 실행한 Prettier 검사는 통과.
- `git diff --check`: 통과.
- 최종 코드 리뷰: Critical/Important 이슈 없음. 계획 문서 완료 기록과 설계 문서 참조를 보완했다.

### 남은 후속 작업

- 화이트보드 문서 상세·수정·삭제 API와 실제 캔버스 미리보기/실시간 동기화는 별도 기능으로 구현한다.
- 기존 migration snapshot의 Prettier 경고는 범위가 다른 별도 정리 작업으로 다룬다.
