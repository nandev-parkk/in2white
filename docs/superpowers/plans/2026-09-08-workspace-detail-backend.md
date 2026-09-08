# 워크스페이스 상세 조회 구현 계획

> **에이전트 작업자용:** 이 계획은 `superpowers:executing-plans` 또는 `superpowers:subagent-driven-development` 방식으로 태스크별 실행한다. 각 단계는 체크박스로 추적한다.

**목표:** 로그인한 사용자가 자신이 소속된 워크스페이스의 기본 정보, 역할, 권한, 프로젝트·멤버 수를 조회할 수 있는 `GET /workspaces/:workspaceId` API를 추가한다.

**구조:** 기존 워크스페이스 라우터·컨트롤러·서비스 계층을 재사용한다. 서비스는 요청 사용자의 멤버십을 기준으로 워크스페이스와 소유자 정보를 조회하고, 별도 집계 쿼리로 멤버 수와 프로젝트 수를 계산한다. 비멤버는 기존 워크스페이스 API와 동일하게 `404 WORKSPACE_NOT_FOUND`로 처리한다.

**기술 스택:** Express, TypeScript, Drizzle ORM, PostgreSQL, Zod, Vitest, Supertest

**명세:** `PRODUCT.md`의 워크스페이스 접근·권한 규칙과 이전 대화에서 확정한 상세 조회 응답 설계

## 전역 제약

- 인증된 요청만 워크스페이스 상세 정보를 조회할 수 있다.
- Owner는 이름 변경·삭제·멤버 관리 권한을 가진다.
- Member도 프로젝트 생성과 멤버 목록 조회 권한을 가진다.
- 기본 워크스페이스는 삭제할 수 없으므로 `canDelete`는 항상 `false`다.
- 실제 권한 검증은 서버 서비스에서 수행하며, 응답의 `permissions`는 UI 표시를 위한 컨텍스트다.
- 사용자가 요청한 커밋이 없으므로 구현 중 커밋을 실행하지 않는다.

---

### 태스크 1: 상세 조회 API 계약을 테스트로 고정

**파일:**

- 수정: `backend/tests/workspace.test.ts`

**인터페이스:**

- 입력: `GET /workspaces/:workspaceId`, Bearer access token
- 출력: `{ workspace: { id, name, owner, isDefault, createdAt, updatedAt, role, permissions, counts } }`

- [x] **1단계: Owner 상세 조회 성공 테스트를 추가한다.**

  `owner` 정보는 `{ id, name }`, `role`은 `owner`, `permissions`는 `canRename/canDelete/canManageMembers/canCreateProject/canViewMembers`를 모두 `true`로 검증한다. `counts`는 `memberCount`와 `projectCount`를 포함하도록 한다.

- [x] **2단계: Member 및 기본 워크스페이스 권한 계산 테스트를 추가한다.**

  `role: member`, `isDefault: true`인 행에 대해 `canRename`, `canDelete`, `canManageMembers`가 `false`, `canCreateProject`, `canViewMembers`가 `true`인지 검증한다.

- [x] **3단계: 인증·접근·DB 오류 테스트를 추가한다.**

  토큰이 없으면 `401 UNAUTHORIZED`, 멤버십 조회 결과가 없으면 `404 WORKSPACE_NOT_FOUND`, 집계 쿼리가 실패하면 `500 INTERNAL_SERVER_ERROR`인지 검증한다.

- [x] **4단계: 새 테스트만 단일 파일로 실행해 RED를 확인한다.**

  실행 명령:

  ```bash
  pnpm --dir backend exec vitest run tests/workspace.test.ts --no-file-parallelism --maxWorkers=1
  ```

  기대 결과: 상세 조회 테스트만 라우트 또는 핸들러가 없어 실패하고, 기존 워크스페이스 테스트는 통과한다.

### 태스크 2: 워크스페이스 상세 조회 서비스 구현

**파일:**

- 수정: `backend/src/services/workspace.service.ts`

**인터페이스:**

- 소비: `workspaceId`, `userId`
- 생성: `getWorkspaceDetail({ workspaceId, userId })`
- 반환: 소유자·역할·권한·집계 수를 포함한 상세 조회 객체

- [x] **1단계: 상세 조회 타입과 서비스 함수를 추가한다.**

  멤버십과 워크스페이스를 내부 조인하고, 소유자 사용자를 조인해 `ownerId`, `ownerName`, `role`을 얻는다. 조회 조건은 `workspaceMemberships.workspaceId = workspaceId`와 `workspaceMemberships.userId = userId`를 함께 사용한다.

- [x] **2단계: 멤버 수와 프로젝트 수를 별도 집계한다.**

  `workspace_memberships`에서 멤버 수를, `projects`에서 해당 워크스페이스의 프로젝트 수를 `count()`로 조회한다. 첫 번째 조회가 비어 있으면 집계하지 않고 `404 WORKSPACE_NOT_FOUND`를 던진다.

- [x] **3단계: 역할과 기본 워크스페이스 여부에서 권한 플래그를 계산한다.**

  Owner는 `canRename`, `canManageMembers`가 true이고, 비기본 워크스페이스일 때만 `canDelete`가 true다. Owner와 Member 모두 `canCreateProject`, `canViewMembers`는 true다.

- [x] **4단계: RED 테스트를 통과시키고 기존 서비스와 중복되는 접근 규칙은 변경하지 않는다.**

### 태스크 3: 컨트롤러와 라우트 연결

**파일:**

- 수정: `backend/src/controllers/workspace.controller.ts`
- 수정: `backend/src/routes/workspace.routes.ts`

**인터페이스:**

- 소비: `requireUser(req)`, `getWorkspaceDetail({ workspaceId, userId })`
- 생성: `GET /workspaces/:workspaceId`

- [x] **1단계: `getWorkspaceDetailHandler`를 추가한다.**

  인증 사용자 ID와 `req.params.workspaceId`를 서비스에 전달하고, 결과를 `{ workspace }`로 감싸 `200` JSON으로 응답한다.

- [x] **2단계: 기존 `GET /` 라우트 뒤에 인증된 `GET /:workspaceId` 라우트를 등록한다.**

  `authenticate`와 `asyncHandler`를 기존 라우트와 같은 순서로 적용한다.

- [x] **3단계: 상세 조회 테스트를 다시 실행해 GREEN을 확인한다.**

### 태스크 4: 전체 검증

**파일:**

- 확인: `backend/tests/workspace.test.ts`
- 확인: `backend/src/services/workspace.service.ts`
- 확인: `backend/src/controllers/workspace.controller.ts`
- 확인: `backend/src/routes/workspace.routes.ts`

- [x] **1단계: 워크스페이스 테스트를 직렬로 실행한다.**

  ```bash
  pnpm --dir backend exec vitest run tests/workspace.test.ts --no-file-parallelism --maxWorkers=1
  ```

- [x] **2단계: 백엔드 전체 테스트를 직렬로 실행한다.**

  ```bash
  pnpm --dir backend exec vitest run --no-file-parallelism --maxWorkers=1
  ```

- [x] **3단계: 타입스크립트 프로덕션 빌드를 실행한다.**

  ```bash
  pnpm --dir backend build
  ```

- [x] **4단계: 변경 파일을 점검하고 커밋하지 않은 상태를 유지한다.**
