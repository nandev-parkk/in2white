# 프로젝트 삭제 백엔드 설계

## 상태

설계 승인 완료 · 사용자 설계 승인 완료 · 구현 및 최종 리뷰 수정 반영 완료 · 자체 검토 완료

## 목표

인증된 워크스페이스 Owner 또는 프로젝트 Creator가 프로젝트를 삭제할 수 있는 백엔드 API를 추가한다. 삭제는 물리 삭제가 아닌 소프트 삭제로 처리하여 프로젝트 행과 하위 화이트보드 문서를 보존하되, 삭제된 프로젝트는 활성 리소스 조회·수정·삭제 대상과 워크스페이스 상세의 프로젝트 집계에서 제외한다.

## 근거 문서

- `PRODUCT.md`
  - 프로젝트 삭제는 워크스페이스 Owner 또는 해당 프로젝트 Creator가 수행할 수 있다.
  - 삭제 전 확인 단계를 거친다. 이번 백엔드 API는 확인된 요청만 처리하고 확인 UI는 범위에서 제외한다.
- `backend/README.md`
  - `routes → controllers → services → db/schema` MVC 계층을 사용한다.
  - Node.js 20+, TypeScript, Express, Drizzle ORM, Vitest, Supertest, pnpm을 사용한다.
- 기존 프로젝트 구현
  - `backend/src/schemas/project.schema.ts`
  - `backend/src/services/project.service.ts`
  - `backend/src/controllers/project.controller.ts`
  - `backend/src/routes/project.routes.ts`
  - `backend/tests/project.test.ts`
- 기존 프로젝트 수정 구현
  - 프로젝트 수정 권한과 오류 계약이 Owner 또는 Creator 기준으로 구현되어 있다.
- 기존 워크스페이스 삭제 구현
  - 인증된 삭제 API는 `204 No Content`를 반환한다.
  - 멤버십 확인을 서비스 트랜잭션 경계에서 수행한다.

## 범위

### 포함

- `DELETE /workspaces/:workspaceId/projects/:projectId` API
- `projects.deleted_at` nullable timestamp 컬럼과 Drizzle migration
- Owner 또는 프로젝트 Creator 권한 확인
- 프로젝트 소프트 삭제와 삭제 시각 기록
- 프로젝트 목록에서 삭제된 프로젝트 제외
- 프로젝트 수정에서 삭제된 프로젝트 제외
- 워크스페이스 상세 `counts.projectCount`에서 삭제된 프로젝트 제외
- 인증·입력·멤버십·권한·중복 삭제·DB 오류 테스트
- 삭제된 프로젝트의 하위 화이트보드 문서를 물리 삭제하지 않는 정책 문서화

### 제외

- 복구 API 또는 복구 UI
- 영구 삭제·보존 기간 만료 정리 작업
- 프론트엔드 삭제 UI 또는 확인 모달
- 화이트보드 문서 API 구현
- 삭제 이벤트 발행, 감사 로그 테이블, 별도 작업 큐
- 프로젝트 이름 중복 정책 변경
- 기존 실제 데이터베이스에서의 migration 실행

## API 계약

### 요청

```http
DELETE /workspaces/:workspaceId/projects/:projectId
Authorization: Bearer <access-token>
```

`workspaceId`와 `projectId`는 UUID여야 한다. 요청 본문은 사용하지 않는다.

### 성공 응답

HTTP `204 No Content`를 반환하며 응답 본문은 없다.

삭제 시 `projects.deletedAt`에 현재 시각을 기록하고 `updatedAt`도 현재 시각으로 갱신한다. 하위 `whiteboard_documents` 행은 삭제하지 않는다.

### 오류 응답

기존 `errorHandlerMiddleware` 형식을 사용한다.

| 상황 | 상태 | 코드 | 처리 |
|---|---:|---|---|
| 인증 헤더가 없거나 유효하지 않음 | 401 | `UNAUTHORIZED` | 인증 middleware에서 차단 |
| `workspaceId` 또는 `projectId`가 UUID가 아님 | 400 | `VALIDATION_ERROR` | controller에서 차단 |
| 사용자가 워크스페이스 멤버가 아님 | 404 | `WORKSPACE_NOT_FOUND` | 프로젝트 존재 여부를 노출하지 않음 |
| Owner가 아니고 프로젝트 Creator도 아님 | 403 | `PROJECT_DELETE_FORBIDDEN` | 삭제하지 않음 |
| 프로젝트가 없거나 다른 워크스페이스에 속함 | 404 | `PROJECT_NOT_FOUND` | 삭제하지 않음 |
| 이미 소프트 삭제된 프로젝트 | 404 | `PROJECT_NOT_FOUND` | 재삭제하지 않음 |
| 예상하지 못한 DB 오류 | 500 | `INTERNAL_SERVER_ERROR` | 기존 오류 처리 계층 사용 |

삭제된 프로젝트는 프로젝트 목록에서 반환하지 않는다. 기존 프로젝트 수정 API도 `deletedAt IS NULL` 조건을 사용하므로 삭제된 프로젝트 수정 요청은 `PROJECT_NOT_FOUND`가 된다. 워크스페이스 상세의 `counts.projectCount`도 `workspaceId`와 `deletedAt IS NULL` 조건을 함께 사용해 활성 프로젝트만 집계한다.

## 권한 규칙

1. `authenticate` middleware가 Access Token을 검증하고 `req.user`를 설정한다.
2. controller가 `requireUser(req)`로 인증 사용자를 가져오고 path parameter를 검증한다.
3. service가 트랜잭션 안에서 `workspace_memberships`의 `workspaceId`, `userId`, `role`을 조회한다.
4. 멤버십이 없으면 `404 WORKSPACE_NOT_FOUND`를 반환한다.
5. 활성 프로젝트를 `projectId`와 `workspaceId`로 조회한다. 프로젝트가 없거나 `deletedAt`이 설정되어 있으면 `404 PROJECT_NOT_FOUND`를 반환한다.
6. 멤버십 role이 `owner`이거나 프로젝트 `creatorId`가 현재 사용자와 같으면 삭제를 허용한다.
7. 그 외 멤버는 `403 PROJECT_DELETE_FORBIDDEN`을 반환한다.

프로젝트 삭제 권한은 기존 프로젝트 수정 권한과 동일하게 유지한다. 멤버십 검사를 프로젝트 조회보다 먼저 수행하여 비멤버에게 프로젝트 존재 여부가 노출되지 않게 한다.

## 데이터 모델

`projects` 테이블에 다음 컬럼을 추가한다.

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `deleted_at` | `timestamp with time zone` | nullable, default 없음 | 소프트 삭제 시각. `NULL`이면 활성 프로젝트 |

Drizzle 모델에서는 `deletedAt: timestamp("deleted_at", { withTimezone: true })`로 정의한다. 기존 행은 `NULL` 상태로 유지되므로 migration은 기존 데이터에 파괴적인 변환을 수행하지 않는다.

삭제는 `projects` 행에만 적용한다. 기존 FK의 `ON DELETE CASCADE`는 물리 삭제가 발생하지 않으므로 하위 `whiteboard_documents`는 보존된다. 현재 화이트보드 문서 API는 없으므로 이번 작업에서 문서 테이블이나 문서 조회 코드는 변경하지 않는다. 이후 문서 API가 추가될 때 프로젝트 활성 상태를 함께 확인해야 한다.

## 아키텍처 및 데이터 흐름

### 라우트

- 기존 `Router({ mergeParams: true })`를 유지한다.
- `DELETE /:projectId`를 `authenticate`와 `asyncHandler`로 등록한다.
- 기존 GET·POST·PATCH 라우트의 경로와 응답은 유지한다.

### Controller

`deleteProjectHandler`는 다음 책임만 가진다.

1. `requireUser(req)`로 인증 사용자를 가져온다.
2. 기존 `projectUpdateParamsSchema` 또는 동일 규칙의 삭제 path schema로 `workspaceId`, `projectId`를 검증한다.
3. `deleteProject({ workspaceId, projectId, userId })`를 호출한다.
4. `res.status(204).send()`로 응답한다.

### Service

`deleteProject`는 하나의 `db.transaction` 안에서 멤버십 조회, 프로젝트 조회, 권한 확인, soft delete update를 수행한다.

```text
membership(workspaceId, userId)
  └─ 없음 → WORKSPACE_NOT_FOUND
active project(projectId, workspaceId, deletedAt IS NULL)
  └─ 없음 → PROJECT_NOT_FOUND
role !== owner && creatorId !== userId
  └─ PROJECT_DELETE_FORBIDDEN
update projects
  set deletedAt = now, updatedAt = now
  where id = projectId
    and workspaceId = workspaceId
    and deletedAt IS NULL
  returning id
  └─ 없음 → PROJECT_NOT_FOUND
```

`returning` 결과가 비어 있으면 동시 삭제 또는 이미 삭제된 상태로 간주하고 `PROJECT_NOT_FOUND`를 반환한다. 삭제 update와 조회 조건에 `workspaceId`를 함께 사용해 다른 워크스페이스의 프로젝트가 변경되지 않게 한다.

### 기존 조회·수정과의 일관성

- `listProjects`의 count query와 rows query 모두 `isNull(projects.deletedAt)` 조건을 포함한다.
- `updateProject`의 project 조회와 update 조건 모두 `isNull(projects.deletedAt)` 조건을 포함한다.
- `getWorkspaceDetail`의 project count query는 workspace 조건과 `isNull(projects.deletedAt)` 조건을 함께 사용한다.
- `createProject`는 새 프로젝트를 `deletedAt = NULL`로 생성하며 기존 생성 계약을 유지한다.
- 삭제된 프로젝트의 하위 문서 데이터는 보존되지만, 향후 문서 조회·수정·삭제 API는 삭제된 상위 프로젝트를 접근 경로에서 제외해야 한다.

## 파일 경계

다음 파일을 추가하거나 수정한다.

- 수정: `backend/src/db/schema/projects.ts`
  - `deletedAt` 컬럼과 타입을 추가한다.
- 추가: Drizzle이 생성한 `backend/src/db/migrations/*.sql`
  - `projects.deleted_at` nullable 컬럼을 추가한다.
- 수정: `backend/src/services/project.service.ts`
  - `isNull` 기반 활성 프로젝트 필터를 목록·수정에 반영한다.
  - `DeleteProjectInput`과 `deleteProject` 유스케이스를 추가한다.
- 수정: `backend/src/services/workspace.service.ts`
  - 워크스페이스 상세의 프로젝트 수를 활성 프로젝트만 대상으로 집계한다.
- 수정: `backend/src/controllers/project.controller.ts`
  - 삭제 handler를 추가한다.
- 수정: `backend/src/routes/project.routes.ts`
  - DELETE 라우트를 연결한다.
- 수정: `backend/src/constants/messages.ts`
  - `PROJECT_DELETE_FORBIDDEN` 메시지를 추가한다.
- 수정: `backend/tests/project.test.ts`
  - 삭제 API 계약, 기존 목록·수정의 deletedAt 필터, 오류 경계를 검증한다.
- 수정: `backend/tests/workspace.test.ts`
  - 워크스페이스 상세 project count query의 `workspaceId + deletedAt IS NULL` 조건을 검증한다.
- 추가: `docs/superpowers/plans/2026-09-09-project-delete-backend-implementation-plan.md`
  - 구현 단계와 결과를 기록한다.

실제 DB에 migration을 적용하는 명령은 실행하지 않는다. migration SQL 파일 생성과 타입·테스트 검증까지만 수행한다.

## 오류 및 경계 조건

- 인증되지 않은 요청은 service와 DB를 호출하지 않는다.
- 잘못된 UUID는 `400 VALIDATION_ERROR`이며 transaction을 호출하지 않는다.
- 비멤버는 프로젝트가 존재하더라도 `WORKSPACE_NOT_FOUND`를 받는다.
- Owner는 다른 사용자가 만든 활성 프로젝트를 삭제할 수 있다.
- Member는 자신이 만든 활성 프로젝트만 삭제할 수 있다.
- 일반 Member가 다른 Creator의 프로젝트를 삭제하면 `PROJECT_DELETE_FORBIDDEN`이다.
- 다른 워크스페이스의 프로젝트 ID를 전달하면 `PROJECT_NOT_FOUND`다.
- 이미 삭제된 프로젝트의 DELETE·PATCH 요청은 `PROJECT_NOT_FOUND`다.
- 삭제 성공은 204이며 body를 반환하지 않는다.
- DB update가 실패하면 기존 내부 오류 처리로 500을 반환한다.
- 삭제된 프로젝트는 목록의 total과 rows 모두에서 제외되어 pagination 결과가 일관된다.
- 삭제된 프로젝트는 워크스페이스 상세의 `counts.projectCount`에서도 제외된다.

## 테스트 전략

`backend/tests/project.test.ts`와 `backend/tests/workspace.test.ts`에서 기존 Supertest·Vitest·DB mock 패턴을 확장한다.

필수 시나리오는 다음과 같다.

1. Owner가 다른 Creator의 활성 프로젝트를 삭제하면 204를 반환하고 `deletedAt`, `updatedAt`을 설정하는 update 호출을 수행한다.
2. 프로젝트 Creator인 Member가 프로젝트를 삭제하면 204를 반환한다.
3. 인증되지 않은 요청은 401이고 transaction을 호출하지 않는다.
4. `workspaceId` 또는 `projectId`가 잘못된 UUID면 400이고 transaction을 호출하지 않는다.
5. 비멤버 요청은 404 `WORKSPACE_NOT_FOUND`이고 프로젝트 update를 호출하지 않는다.
6. 권한 없는 Member 요청은 403 `PROJECT_DELETE_FORBIDDEN`이고 프로젝트 update를 호출하지 않는다.
7. 프로젝트가 없거나 이미 삭제된 경우 404 `PROJECT_NOT_FOUND`다.
8. 다른 workspace의 projectId는 404이며 update하지 않는다.
9. delete update DB 오류는 500 `INTERNAL_SERVER_ERROR`다.
10. 프로젝트 목록 count와 rows query에 `deletedAt IS NULL` 조건이 포함된다.
11. 프로젝트 수정 조회와 update 조건에 `deletedAt IS NULL` 조건이 포함된다.
12. 워크스페이스 상세 project count query에 `workspaceId`와 `deletedAt IS NULL` 조건이 함께 포함된다.

검증 명령은 다음과 같다.

```bash
pnpm --dir backend test -- tests/workspace.test.ts tests/project.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src/services/workspace.service.ts tests/workspace.test.ts
git diff --check
```

## 완료 기준

- 프로젝트 삭제 API의 권한·오류·204 응답 계약이 충족된다.
- 삭제 시 프로젝트 행과 하위 화이트보드 문서는 보존되고 `deletedAt`, `updatedAt`이 기록된다.
- 프로젝트 목록 count/rows, 수정 조회/update, 워크스페이스 상세 `counts.projectCount`가 활성 프로젝트만 대상으로 한다.
- schema와 migration 파일이 nullable `projects.deleted_at`을 일관되게 표현하며 실제 migration은 적용하지 않는다.
- 관련 테스트, 전체 테스트, lint, build, 변경 source/test Prettier, diff 검사가 통과한다.
- 기존 전체 Prettier baseline의 무관한 2개 파일 경고는 별도 후속 작업으로 유지한다.

## 결정 사항

- 작업 범위는 백엔드 API와 DB schema/migration으로 한정한다.
- 삭제는 `deletedAt` timestamp를 기록하는 소프트 삭제다.
- 복구 API·UI는 제공하지 않는다.
- 성공 응답은 `204 No Content`다.
- 삭제 권한은 워크스페이스 Owner 또는 프로젝트 Creator다.
- 비멤버는 `WORKSPACE_NOT_FOUND`, 권한 없는 Member는 `PROJECT_DELETE_FORBIDDEN`, 대상 없음·이미 삭제됨은 `PROJECT_NOT_FOUND`다.
- 목록·수정과 워크스페이스 상세 프로젝트 집계는 활성 프로젝트(`deletedAt IS NULL`)만 대상으로 한다.
- 하위 화이트보드 문서는 물리 삭제하지 않는다.
- 실제 DB migration 실행과 Git commit은 사용자 요청 전까지 하지 않는다.
