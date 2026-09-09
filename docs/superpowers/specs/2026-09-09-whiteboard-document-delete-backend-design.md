# 화이트보드 문서 삭제 백엔드 설계

## 상태

설계 승인 완료 · 사용자 설계 방향 승인 완료

## 목표

인증된 워크스페이스 Owner 또는 화이트보드 문서 Creator가 문서를 삭제할 수 있는 API를 추가한다. 삭제는 물리 삭제가 아닌 소프트 삭제로 처리하여 문서 행과 캔버스 콘텐츠를 보존하고, 삭제된 문서는 활성 문서 목록·수정·삭제 대상에서 제외한다.

## 근거 문서

- [`PRODUCT.md`](../../../PRODUCT.md)
  - 화이트보드 문서 삭제는 워크스페이스 Owner 또는 해당 문서 Creator가 수행할 수 있다.
  - 캔버스 콘텐츠는 실시간 편집되며 문서의 최신 상태를 유지한다.
- [`2026-09-09-whiteboard-document-update-backend-design.md`](./2026-09-09-whiteboard-document-update-backend-design.md)
  - 문서 이름 변경은 Owner 또는 문서 Creator 권한을 사용한다.
  - 멤버십 → 활성 프로젝트 → 프로젝트 소속 문서 → 권한 순서로 접근을 확인한다.
- [`2026-09-09-project-delete-backend-design.md`](./2026-09-09-project-delete-backend-design.md)
  - 프로젝트 삭제는 `deleted_at` 기반 소프트 삭제와 `204 No Content` 응답을 사용한다.
  - 삭제된 프로젝트의 하위 문서 데이터는 물리 삭제하지 않는다.
- 기존 화이트보드 문서 구현
  - `routes → controllers → services → db/schema` 계층과 Express·Drizzle·Zod·Supertest 테스트 패턴을 유지한다.

## 범위

### 포함

- `DELETE /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId` API
- `whiteboard_documents.deleted_at` nullable timestamp 컬럼과 Drizzle migration 파일
- Owner 또는 문서 Creator 권한 확인
- 문서 소프트 삭제와 삭제 시각 기록
- 화이트보드 문서 목록의 count/rows에서 삭제 문서 제외
- 기존 문서 이름 변경의 조회·수정 대상에서 삭제 문서 제외
- 삭제된 문서의 DELETE·PATCH 요청을 `404 WHITEBOARD_DOCUMENT_NOT_FOUND`로 처리
- 인증·입력·권한·미존재·중복 삭제·DB 오류 테스트

### 제외

- 복구 API 또는 복구 UI
- 영구 삭제·보존 기간 만료 정리 작업
- 프론트엔드 삭제 UI 또는 확인 모달
- 캔버스 콘텐츠 변경·자동 저장·실시간 협업 동작
- 삭제 이벤트 발행, 감사 로그, 별도 작업 큐
- 실제 운영 데이터베이스에 migration 적용
- 프로젝트 삭제 시 하위 문서 행의 물리 삭제

## API 계약

### 요청

```http
DELETE /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId
Authorization: Bearer <access-token>
```

요청 본문은 사용하지 않는다. `workspaceId`, `projectId`, `documentId`는 모두 UUID여야 한다.

### 성공 응답

HTTP `204 No Content`를 반환하며 응답 본문은 없다.

삭제 시 `whiteboardDocuments.deletedAt`과 `updatedAt`에 동일한 현재 시각을 기록한다. `canvasContent`, `createdAt`, `creatorId` 등 문서의 보존 데이터는 변경하지 않는다.

### 오류 응답

기존 `errorHandlerMiddleware` 형식을 사용한다.

| 상황 | 상태 | 코드 | 처리 |
|---|---:|---|---|
| 인증 헤더가 없거나 유효하지 않음 | 401 | `UNAUTHORIZED` | 인증 middleware에서 차단 |
| path UUID가 유효하지 않음 | 400 | `VALIDATION_ERROR` | controller에서 차단 |
| 사용자가 워크스페이스 멤버가 아님 | 404 | `WORKSPACE_NOT_FOUND` | 프로젝트·문서 존재 여부를 노출하지 않음 |
| 프로젝트가 없거나 다른 워크스페이스에 속하거나 삭제됨 | 404 | `PROJECT_NOT_FOUND` | 문서 query와 delete를 실행하지 않음 |
| 문서가 없거나 다른 프로젝트에 속하거나 이미 삭제됨 | 404 | `WHITEBOARD_DOCUMENT_NOT_FOUND` | 삭제하지 않음 |
| Owner도 아니고 문서 Creator도 아님 | 403 | `WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN` | 삭제하지 않음 |
| 예상하지 못한 DB 오류 | 500 | `INTERNAL_SERVER_ERROR` | 기존 오류 처리 계층 사용 |

삭제된 문서는 목록의 total과 rows에서 모두 제외한다. 삭제된 문서에 대한 이름 변경과 재삭제는 활성 문서 query가 찾지 못하므로 `WHITEBOARD_DOCUMENT_NOT_FOUND`를 반환한다.

## 권한 및 보안 규칙

1. `authenticate` middleware가 Access Token을 검증하고 `req.user`를 설정한다.
2. controller가 `requireUser(req)`로 인증 사용자 ID를 가져오고 세 path parameter를 검증한다.
3. service가 하나의 transaction 안에서 `workspace_memberships`의 `workspaceId`, `userId`, `role`을 조회한다.
4. 멤버십이 없으면 `404 WORKSPACE_NOT_FOUND`를 반환한다. 이때 프로젝트와 문서 query를 실행하지 않는다.
5. `projects`에서 `projectId`, `workspaceId`, `deletedAt IS NULL` 조건으로 활성 프로젝트를 조회한다.
6. 프로젝트가 없으면 `404 PROJECT_NOT_FOUND`를 반환한다.
7. `whiteboard_documents`에서 `documentId`, `projectId`, `deletedAt IS NULL` 조건으로 활성 문서의 `creatorId`를 조회한다.
8. 문서가 없으면 `404 WHITEBOARD_DOCUMENT_NOT_FOUND`를 반환한다.
9. 멤버십 role이 `owner`이거나 문서 `creatorId`가 현재 사용자 ID와 같으면 삭제를 허용한다.
10. 그 외 `member`는 `403 WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN`을 반환한다.
11. update 조건에도 문서 ID·프로젝트 ID·`deletedAt IS NULL`을 포함한다. `returning` 결과가 없으면 동시 삭제 또는 이미 삭제된 상태로 간주하여 `404 WHITEBOARD_DOCUMENT_NOT_FOUND`를 반환한다.

멤버십을 프로젝트·문서보다 먼저 확인하여 비멤버에게 리소스 존재 여부를 노출하지 않는다. 모든 활성 상태 확인과 soft delete update는 하나의 transaction으로 묶는다.

## 데이터 모델 및 보존 정책

`whiteboard_documents` 테이블에 다음 컬럼을 추가한다.

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `deleted_at` | `timestamp with time zone` | nullable, default 없음 | 소프트 삭제 시각. `NULL`이면 활성 문서 |

Drizzle 모델에서는 다음과 같이 정의한다.

```ts
deletedAt: timestamp("deleted_at", { withTimezone: true }),
```

기존 행과 새 문서는 `NULL`로 시작한다. migration은 nullable 컬럼만 추가하며 기존 데이터를 변환하거나 삭제하지 않는다. 소프트 삭제는 `DELETE` SQL이 아니라 `UPDATE`로 수행하므로 `projectId`·`creatorId`·`canvasContent`와 기존 FK 관계는 보존된다.

프로젝트가 소프트 삭제된 경우 프로젝트 query가 활성 프로젝트를 찾지 못하므로 해당 프로젝트의 문서 목록·이름 변경·삭제는 모두 접근할 수 없다. 프로젝트 삭제 자체는 하위 문서 행을 물리 삭제하지 않는 기존 정책을 유지한다.

## 아키텍처 및 데이터 흐름

### 라우트

- 기존 `Router({ mergeParams: true })`를 유지한다.
- `DELETE /:documentId`를 `authenticate`와 `asyncHandler`로 등록한다.
- 기존 GET·POST·PATCH 라우트의 경로와 성공 응답은 유지한다.

### Controller

`deleteWhiteboardDocumentHandler`는 다음 책임만 가진다.

1. `requireUser(req)`로 인증 사용자를 가져온다.
2. 기존 수정용 params schema와 동일한 세 UUID 규칙으로 `workspaceId`, `projectId`, `documentId`를 검증한다.
3. `deleteWhiteboardDocument({ workspaceId, projectId, documentId, userId })`를 호출한다.
4. `res.status(204).send()`로 응답한다.

### Service

`deleteWhiteboardDocument`는 하나의 `db.transaction` 안에서 멤버십 조회, 활성 프로젝트 조회, 활성 문서 조회, 권한 확인, soft delete update를 수행한다.

```text
membership(workspaceId, userId)
  └─ 없음 → WORKSPACE_NOT_FOUND
active project(projectId, workspaceId, deletedAt IS NULL)
  └─ 없음 → PROJECT_NOT_FOUND
active document(documentId, projectId, deletedAt IS NULL)
  └─ 없음 → WHITEBOARD_DOCUMENT_NOT_FOUND
role !== owner && creatorId !== userId
  └─ WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN
update whiteboard_documents
  set deletedAt = now, updatedAt = now
  where id = documentId
    and projectId = projectId
    and deletedAt IS NULL
  returning id
  └─ 없음 → WHITEBOARD_DOCUMENT_NOT_FOUND
204 No Content
```

### 기존 목록·수정과의 일관성

- `listWhiteboardDocuments`의 count query와 rows query 모두 `isNull(whiteboardDocuments.deletedAt)` 조건을 포함한다.
- `updateWhiteboardDocument`의 문서 조회와 update 조건 모두 `isNull(whiteboardDocuments.deletedAt)` 조건을 포함한다.
- `createWhiteboardDocument`는 새 문서를 생성하며 nullable `deletedAt`의 기본 `NULL` 상태를 사용한다.
- 문서 목록 응답 projection에는 `deletedAt`을 추가하지 않는다. 활성 문서만 반환하므로 기존 목록 계약을 유지한다.

## 파일 경계

다음 파일을 추가하거나 수정한다.

- 수정: `backend/src/db/schema/whiteboard-documents.ts`
  - nullable `deletedAt` 컬럼을 추가한다.
- 추가: `backend/src/db/migrations/*.sql`
  - `whiteboard_documents.deleted_at` nullable 컬럼 추가 migration을 생성한다.
- 수정: `backend/src/constants/messages.ts`
  - `WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN` 메시지를 추가한다.
- 수정: `backend/src/services/whiteboard-document.service.ts`
  - `DeleteWhiteboardDocumentInput`과 `deleteWhiteboardDocument` 유스케이스를 추가한다.
  - 기존 목록·이름 변경 query에 활성 문서 조건을 추가한다.
- 수정: `backend/src/controllers/whiteboard-document.controller.ts`
  - DELETE handler를 추가한다.
- 수정: `backend/src/routes/whiteboard-document.routes.ts`
  - 인증된 DELETE route를 연결한다.
- 수정: `backend/tests/db-schema.test.ts`
  - `whiteboardDocuments.deletedAt` schema export를 검증한다.
- 수정: `backend/tests/whiteboard-document.test.ts`
  - DELETE API 계약, 기존 목록·수정의 활성 문서 필터, 오류 경계를 검증한다.
- 추가: `docs/superpowers/plans/2026-09-09-whiteboard-document-delete-backend-implementation-plan.md`
  - 승인된 설계를 기준으로 구현 단계와 최종 결과를 기록한다.

변경하지 않는 파일과 이유는 다음과 같다.

- `backend/src/db/schema/relations.ts`: 관계 정의는 유지되며 컬럼 추가만으로 충분하다.
- `backend/src/routes/index.ts`: 기존 whiteboard document router mount path를 그대로 사용한다.
- `frontend/**`: 이번 요청은 백엔드 API 기능으로 한정한다.
- `backend/src/db/migrations`의 기존 SQL: 새 migration만 추가하고 기존 migration은 수정하지 않는다.

## 오류 및 경계 조건

- 인증되지 않은 요청은 service와 DB를 호출하지 않는다.
- 잘못된 UUID는 `400 VALIDATION_ERROR`이며 transaction을 호출하지 않는다.
- 비멤버는 프로젝트가 존재하더라도 `WORKSPACE_NOT_FOUND`를 받는다.
- Owner는 다른 사용자가 만든 활성 문서를 삭제할 수 있다.
- Member는 자신이 만든 활성 문서만 삭제할 수 있다.
- 일반 Member가 다른 Creator의 문서를 삭제하면 `WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN`이다.
- 다른 project의 documentId 또는 다른 workspace의 projectId는 각각 `WHITEBOARD_DOCUMENT_NOT_FOUND` 또는 `PROJECT_NOT_FOUND`다.
- 이미 삭제된 문서는 DELETE·PATCH·목록에서 활성 문서로 취급하지 않는다.
- 삭제 성공은 204이며 body를 반환하지 않는다.
- DB update가 실패하면 기존 내부 오류 처리로 500을 반환한다.
- 동시 삭제로 update returning이 비어도 문서 미존재와 동일하게 404를 반환한다.

## 테스트 전략

`backend/tests/whiteboard-document.test.ts`와 `backend/tests/db-schema.test.ts`에서 기존 Supertest·Vitest·Drizzle mock 패턴을 확장한다.

필수 시나리오는 다음과 같다.

1. Owner가 다른 Creator의 활성 문서를 삭제하면 204를 반환하고 `deletedAt`, `updatedAt`을 설정한다.
2. 문서 Creator인 Member가 문서를 삭제하면 204를 반환한다.
3. update set에는 `deletedAt`, `updatedAt`만 포함되고 문서 콘텐츠는 변경하지 않는다.
4. 인증되지 않은 요청은 401이고 transaction을 호출하지 않는다.
5. 세 path UUID 중 하나라도 잘못되면 400이고 transaction을 호출하지 않는다.
6. 비멤버 요청은 404 `WORKSPACE_NOT_FOUND`이고 프로젝트·문서·update query를 호출하지 않는다.
7. 프로젝트가 없거나 삭제된 경우 404 `PROJECT_NOT_FOUND`이고 문서·update query를 호출하지 않는다.
8. 문서가 없거나 다른 프로젝트에 속하거나 이미 삭제된 경우 404 `WHITEBOARD_DOCUMENT_NOT_FOUND`이고 update하지 않는다.
9. 권한 없는 Member 요청은 403 `WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN`이고 update하지 않는다.
10. 문서 delete update DB 오류는 500 `INTERNAL_SERVER_ERROR`다.
11. 목록 count/rows query가 `deletedAt IS NULL` 조건을 포함하고 삭제 문서를 반환하지 않는다.
12. 문서 이름 변경 query와 update 조건이 `deletedAt IS NULL`을 포함한다.
13. 기존 화이트보드 생성·목록·이름 변경 테스트가 계속 통과한다.

검증 명령은 다음과 같다.

```bash
pnpm --dir backend test -- tests/db-schema.test.ts tests/whiteboard-document.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src tests
git diff --check
```

실제 데이터베이스에 migration을 적용하는 `pnpm --dir backend db:migrate`는 실행하지 않는다.

## 결정 사항

- 화이트보드 문서 삭제는 `deleted_at` 기반 소프트 삭제로 처리한다.
- API는 `DELETE /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId`로 한다.
- 성공 응답은 프로젝트 삭제 API와 같은 `204 No Content`로 한다.
- 삭제 권한은 워크스페이스 Owner 또는 문서 Creator에게만 부여한다.
- 멤버십 → 활성 프로젝트 → 활성 문서 → 권한 순서로 확인한다.
- 문서 목록의 count와 rows, 문서 이름 변경의 조회와 update 모두 `deletedAt IS NULL`을 사용한다.
- 삭제된 문서와 프로젝트의 하위 문서 데이터는 물리적으로 삭제하지 않는다.
- 복구·영구 삭제·프론트엔드 UI는 이번 범위에 포함하지 않는다.
- migration 파일은 생성하지만 실제 데이터베이스에는 적용하지 않는다.
- Git commit·push·merge·PR은 사용자의 별도 요청 없이는 실행하지 않는다.
