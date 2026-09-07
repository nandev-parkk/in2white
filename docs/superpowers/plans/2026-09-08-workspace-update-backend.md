# 워크스페이스 수정 기능 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 워크스페이스 소유자가 이름을 수정하고, 생성·조회·수정 결과에서 최종 수정 시각을 확인할 수 있는 백엔드 기능을 추가한다.

**Architecture:** `PATCH /workspaces/:workspaceId` 엔드포인트를 기존 워크스페이스 라우터에 추가한다. 서비스는 트랜잭션 안에서 요청자의 멤버십과 소유자 권한을 확인한 뒤 `name`과 `updatedAt`만 수정하며, 워크스페이스 테이블에 `updatedAt` 컬럼을 추가한다. 기본 워크스페이스 여부와 소유자는 이 API에서 변경하지 않는다.

**Tech Stack:** Node.js 20+, TypeScript, Express, Zod, Drizzle ORM/PostgreSQL, Vitest, Supertest, pnpm.

**Spec:** `PRODUCT.md`, `DESIGN.md`의 워크스페이스 모델·권한·워크스페이스 설정 규칙

## Global Constraints

- 모든 사용자 메시지와 문서는 한국어로 작성한다.
- 워크스페이스 설정은 소유자 전용이며, 기본 워크스페이스는 삭제할 수 있지만 이름 변경은 가능하다.
- 이름은 생성 API와 동일하게 trim 후 1자 이상 255자 이하를 허용한다.
- 기존 워크스페이스 생성·목록 구현과 현재 작업 트리의 미커밋 변경 사항을 보존한다.
- 데이터베이스 스키마 변경은 `updated_at timestamp with time zone DEFAULT now() NOT NULL`로 추가한다.
- 워크스페이스 생성 시 `updatedAt`은 데이터베이스 기본값으로 채우고, 이름 수정 시 새 시각으로 갱신한다.
- 커밋, 푸시, 머지, 실제 데이터베이스 마이그레이션 실행은 사용자가 별도로 요청하기 전까지 수행하지 않는다.
- 각 구현 단계는 테스트 우선으로 진행하고, 구현 후 `pnpm --dir backend test`, `pnpm --dir backend lint`, `pnpm --dir backend build`로 검증한다.

---

### Task 1: 워크스페이스 수정 및 `updatedAt` 계약에 대한 실패 테스트 작성

**Files:**
- Modify: `backend/tests/workspace.test.ts`

**Interfaces:**
- Consumes: 기존 `POST /workspaces`, `GET /workspaces` 테스트와 `db.transaction` 테스트 목킹 패턴
- Produces: Task 2가 만족해야 하는 수정 API와 `updatedAt` 응답 계약

- [ ] **Step 1: 생성·목록 응답에 `updatedAt`을 포함하도록 기존 테스트 픽스처와 기대값을 확장한다.**

  생성 픽스처와 목록 행에 동일한 `Date` 값을 넣고, 응답에 ISO 문자열로 직렬화된 `updatedAt`이 포함되는지 검증한다. 목록 조회 쿼리가 `workspaces.updatedAt`을 선택해야 한다는 계약도 테스트에서 확인한다.

- [ ] **Step 2: `PATCH /workspaces/:workspaceId` 성공 테스트를 작성한다.**

  인증된 소유자와 멤버십 조회 결과를 목킹하고, 이름 앞뒤 공백이 제거된 값과 `updatedAt`이 `Date`로 설정된 값으로 update query가 호출되는지 검증한다. 응답은 `200`이며 수정된 workspace 객체를 반환해야 한다.

- [ ] **Step 3: 권한·입력·실패 경로 테스트를 작성한다.**

  다음 동작을 각각 검증한다.

  - 인증 토큰이 없으면 `401 UNAUTHORIZED`이며 데이터베이스를 호출하지 않는다.
  - 이름이 공백이거나 255자를 초과하면 `400 VALIDATION_ERROR`이며 데이터베이스를 호출하지 않는다.
  - 멤버십이 없으면 `404 WORKSPACE_NOT_FOUND`이며 update query를 호출하지 않는다.
  - 멤버 역할이면 `403 WORKSPACE_UPDATE_FORBIDDEN`이며 update query를 호출하지 않는다.
  - 데이터베이스 수정이 실패하면 `500 INTERNAL_SERVER_ERROR`를 반환한다.

- [ ] **Step 4: 테스트를 실행해 RED 상태를 확인한다.**

  Run: `pnpm --dir backend test -- tests/workspace.test.ts`

  Expected: `PATCH /workspaces/:workspaceId` 라우트와 `updatedAt` 필드가 아직 구현되지 않았기 때문에 실패한다. 기존 생성·목록 테스트가 실패한다면 테스트 목킹 오류를 먼저 수정하고, 구현 누락으로 인한 실패만 남긴다.

- [ ] **Step 5: 커밋하지 않고 테스트 변경을 리뷰받는다.**

  이 저장소의 사용자 규칙에 따라 커밋 단계는 생략한다. 테스트가 실제 응답·권한·DB 호출 계약을 검증하는지 확인한 뒤 Task 2로 진행한다.

### Task 2: `updatedAt` 스키마와 소유자 전용 수정 API 구현

**Files:**
- Modify: `PRODUCT.md`
- Modify: `backend/src/db/schema/workspaces.ts`
- Create: `backend/src/db/migrations/0001_add_workspace_updated_at.sql` 또는 Drizzle 생성 규칙에 따른 동일 변경의 migration 파일
- Modify: `backend/src/db/migrations/meta/_journal.json` 및 Drizzle 생성으로 갱신되는 snapshot 파일
- Modify: `backend/src/constants/messages.ts`
- Modify: `backend/src/schemas/workspace.schema.ts`
- Modify: `backend/src/services/workspace.service.ts`
- Modify: `backend/src/controllers/workspace.controller.ts`
- Modify: `backend/src/routes/workspace.routes.ts`
- Test: `backend/tests/workspace.test.ts`

**Interfaces:**
- Consumes: Task 1의 `PATCH /workspaces/:workspaceId` 테스트 계약
- Produces: `updateWorkspace({ workspaceId, name, userId })` 서비스 함수와 `PATCH /workspaces/:workspaceId` API

- [ ] **Step 1: 워크스페이스 모델과 migration을 `updatedAt` 기준으로 확장한다.**

  `backend/src/db/schema/workspaces.ts`의 `workspaces` 정의에 다음 필드를 추가한다.

  ```ts
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  ```

  기존 `0000_normal_gamora.sql`을 수정하지 않고 `pnpm --dir backend db:generate`를 실행해 새 migration과 Drizzle metadata를 생성한다. 생성된 SQL은 기존 행을 보존하면서 다음 의미를 가져야 한다.

  ```sql
  ALTER TABLE "workspaces"
  ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
  ```

  `PRODUCT.md`의 Workspace Key Attributes에 `최종 수정일`을 추가해 도메인 모델과 스키마를 일치시킨다. 화면에 최종 수정일을 표시하는 요구사항은 없으므로 `DESIGN.md`는 변경하지 않는다.

- [ ] **Step 2: 생성·목록 응답에 `updatedAt`을 연결한다.**

  생성 서비스는 새 컬럼의 데이터베이스 기본값을 반환하도록 기존 `returning()` 결과를 그대로 사용한다. 목록 서비스의 select projection에는 `updatedAt: workspaces.updatedAt`을 추가한다. 목록 정렬 규칙과 응답의 나머지 필드는 변경하지 않는다.

- [ ] **Step 3: 이름 검증 스키마와 오류 메시지를 추가한다.**

  이름 문자열 검증 규칙을 재사용할 수 있도록 `workspaceNameSchema`를 추출하고, `createWorkspaceSchema`와 `updateWorkspaceSchema`가 같은 규칙을 사용하도록 한다. `updateWorkspaceSchema`의 입력은 `{ name: string }` 하나로 제한한다.

  `ERROR_MESSAGES`에는 다음 상수를 추가한다.

  ```ts
  WORKSPACE_NOT_FOUND: "워크스페이스를 찾을 수 없습니다",
  WORKSPACE_UPDATE_FORBIDDEN: "워크스페이스를 수정할 권한이 없습니다",
  ```

- [ ] **Step 4: 소유자 권한 확인과 원자적 수정을 서비스에 구현한다.**

  `workspace.service.ts`에 다음 입력과 함수를 추가한다.

  ```ts
  export interface UpdateWorkspaceInput {
    workspaceId: string;
    name: string;
    userId: string;
  }

  export async function updateWorkspace(
    input: UpdateWorkspaceInput,
  ): Promise<typeof workspaces.$inferSelect>;
  ```

  함수는 `db.transaction` 안에서 다음 순서로 동작한다.

  1. `workspace_memberships`에서 `workspaceId`와 `userId`가 일치하는 멤버십을 조회한다.
  2. 멤버십이 없으면 `HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND)`를 던진다.
  3. 역할이 `owner`가 아니면 `HttpError(403, "WORKSPACE_UPDATE_FORBIDDEN", ERROR_MESSAGES.WORKSPACE_UPDATE_FORBIDDEN)`를 던진다.
  4. `workspaces`를 `workspaceId`와 `ownerId === userId` 조건으로 수정한다.
  5. update 값은 `{ name, updatedAt: new Date() }`만 사용하고 `ownerId`, `isDefault`는 변경하지 않는다.
  6. `returning()` 결과가 없으면 `WORKSPACE_NOT_FOUND` 오류를 던지고, 있으면 수정된 workspace를 반환한다.

- [ ] **Step 5: 컨트롤러와 라우터에 PATCH 엔드포인트를 연결한다.**

  `updateWorkspaceHandler`는 생성·목록 핸들러와 같은 인증 확인 방식을 사용하고, `req.params.workspaceId`와 `updateWorkspaceSchema`를 검증한 뒤 다음처럼 호출한다.

  ```ts
  const workspace = await updateWorkspace({
    workspaceId: req.params.workspaceId,
    name: parsed.data.name,
    userId: req.user.sub,
  });
  res.status(200).json({ workspace });
  ```

  `workspaceRouter`에 `PATCH /:workspaceId`를 `authenticate`와 `asyncHandler`로 등록한다. 기존 POST·GET 라우트의 경로와 응답은 유지한다.

- [ ] **Step 6: 집중 테스트로 GREEN을 확인한다.**

  Run: `pnpm --dir backend test -- tests/workspace.test.ts`

  Expected: workspace 테스트 전체 PASS.

- [ ] **Step 7: 전체 검증을 실행한다.**

  Run: `pnpm --dir backend test`

  Expected: 전체 테스트 PASS.

  Run: `pnpm --dir backend lint`

  Expected: lint 오류 0건.

  Run: `pnpm --dir backend build`

  Expected: TypeScript 빌드 성공.

  Run: `pnpm --dir backend exec prettier --check src tests`

  Expected: 포맷 오류 0건.

- [ ] **Step 8: 커밋하지 않고 변경 범위와 migration을 최종 확인한다.**

  `git diff --check`와 `git status --short`로 공백 오류 및 의도하지 않은 파일 변경을 확인한다. 기존 미커밋 변경 사항을 되돌리거나 커밋하지 않는다.

## Self-Review Checklist

- `PRODUCT.md`의 Workspace Key Attributes, DB schema, migration, 생성 응답, 목록 응답, 수정 응답이 모두 `updatedAt`을 일관되게 반영하는지 확인한다.
- 기본 워크스페이스의 이름 변경은 허용되고, `isDefault`는 수정되지 않는지 확인한다.
- 멤버와 비소속 사용자의 오류 상태·코드가 테스트에 고정되어 있는지 확인한다.
- 이름 검증이 생성과 수정에서 동일한 trim·길이 규칙을 사용하는지 확인한다.
- `updatedAt`이 수정 요청마다 실제 새 `Date`로 설정되는지 확인한다.
- 기존 생성·목록 API의 정렬과 응답 필드를 불필요하게 변경하지 않았는지 확인한다.
- 계획에 커밋을 요구하는 단계가 없고, 현재 작업 트리의 기존 변경 사항을 보존하는지 확인한다.
