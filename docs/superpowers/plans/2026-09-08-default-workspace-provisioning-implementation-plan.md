# 기본 워크스페이스 자동 제공 구현 계획

> **에이전트 작업자용:** 이 계획은 승인된 설계를 테스트 우선으로 실행한다. 각 태스크를 순서대로 처리하고, 사용자 요청 없이는 Git commit·push·PR을 실행하지 않는다.

**Goal:** 사용자 생성 시 `My Workspace` 기본 워크스페이스와 owner 멤버십을 원자적으로 만들고, 기존 `test@example.com` 계정을 idempotent하게 보정한다.

**Architecture:** `users` upsert와 기본 워크스페이스·멤버십 처리를 `user.service.ts`의 단일 Drizzle transaction으로 캡슐화한다. 관리자용 `create-test-user.ts`는 이 서비스를 호출한다. 기존 워크스페이스 삭제 서비스의 `isDefault` 보호 규칙은 그대로 사용한다.

**Tech Stack:** Node.js, TypeScript, Drizzle ORM/PostgreSQL, Vitest, pnpm.

**Spec:** [`2026-09-08-default-workspace-provisioning-design.md`](../specs/2026-09-08-default-workspace-provisioning-design.md)

## 전역 제약

- 모든 코드 주석과 문서는 한국어로 작성한다.
- 사용자 upsert, 기본 워크스페이스 생성, owner 멤버십 처리는 하나의 transaction에서 실행한다.
- 기본 워크스페이스는 `name = "My Workspace"`, `isDefault = true`로 생성한다.
- 기존 기본 워크스페이스의 이름은 재실행 시 덮어쓰지 않는다.
- 멤버십은 `(workspace_id, user_id)` unique 제약을 활용해 중복 생성하지 않는다.
- 현재 기존 사용자 보정 대상은 `test@example.com` 하나뿐이다.
- 회원가입 API, 전체 기존 사용자 backfill, 스키마·마이그레이션 변경은 하지 않는다.
- Git commit은 사용자가 별도로 요청하기 전까지 실행하지 않는다.

---

## Task 1: Provisioning 서비스 실패 테스트 작성

**Files:**

- Modify: `backend/tests/user-service.test.ts`

**Interfaces:**

- Consumes: 기존 `getUserByEmail`, `getUserById` 테스트와 `db` mock
- Produces: `upsertUserWithDefaultWorkspace`가 만족해야 하는 transaction 계약

- [x] **Step 1: `db.transaction` mock을 테스트 모듈에 추가한다.**

  `vi.mock("@/db/client")`의 db 객체에 `transaction: vi.fn()`을 추가한다. 기존 조회 테스트가 서로 영향을 받지 않도록 각 테스트 전 `db.transaction`을 reset한다.

- [x] **Step 2: 새 사용자 provisioning의 RED 테스트를 작성한다.**

  users insert가 새 사용자 행을 반환하고, workspace 조회가 빈 배열을 반환하며, workspace insert가 기본 워크스페이스를 반환하도록 transaction mock을 구성한다. 다음 계약을 검증한다.

  - `db.transaction`이 한 번 호출된다.
  - users insert가 입력 이메일·이름·비밀번호 해시를 사용한다.
  - workspace insert가 `{ name: "My Workspace", ownerId: "user-1", isDefault: true }`를 사용한다.
  - membership insert가 `{ workspaceId: "workspace-default", userId: "user-1", role: "owner" }`를 사용한다.
  - 세 insert/query가 callback에 전달된 같은 transaction 객체를 사용한다.

- [x] **Step 3: 기존 사용자에게 기본 워크스페이스를 보정하는 RED 테스트를 작성한다.**

  users upsert가 기존 사용자 행을 반환하고 workspace 조회가 빈 배열을 반환하는 상황을 구성한다. 기존 ID로 새 기본 워크스페이스와 owner 멤버십이 생성되는지 검증한다.

- [x] **Step 4: 이미 기본 워크스페이스가 있는 경우 중복 생성하지 않는 RED 테스트를 작성한다.**

  workspace 조회가 기존 `isDefault: true` 행을 반환하게 하고, workspace insert가 호출되지 않는지 검증한다. owner 멤버십 보정 query만 실행되는지 확인한다.

- [x] **Step 5: 하위 처리 오류가 전파되는 RED 테스트를 작성한다.**

  membership insert가 reject되도록 구성하고 `upsertUserWithDefaultWorkspace`가 같은 오류를 throw하는지 검증한다.

- [x] **Step 6: 테스트를 실행해 RED 상태를 확인한다.**

  Run: `pnpm --dir backend test -- tests/user-service.test.ts`

  Expected: 아직 `upsertUserWithDefaultWorkspace`가 없으므로 새 테스트가 실패하고, 기존 사용자 조회 테스트는 통과한다.

---

## Task 2: 사용자와 기본 워크스페이스 provisioning 구현

**Files:**

- Modify: `backend/src/services/user.service.ts`
- Test: `backend/tests/user-service.test.ts`

**Interfaces:**

- Produces: `upsertUserWithDefaultWorkspace({ email, name, passwordHash })`

- [x] **Step 1: 필요한 스키마와 Drizzle 연산자를 import한다.**

  `and`, `eq`와 `users`, `workspaces`, `workspaceMemberships`를 가져온다. 기존 `getUserByEmail`과 `getUserById` 동작은 변경하지 않는다.

- [x] **Step 2: 사용자 upsert를 transaction 안에 구현한다.**

  `tx.insert(users).values(...).onConflictDoUpdate({ target: users.email, set: { name, passwordHash } }).returning()`으로 사용자 행을 확보한다. 반환 행이 없으면 오류를 발생시킨다.

- [x] **Step 3: 기본 워크스페이스를 조회하거나 생성한다.**

  `ownerId`와 `isDefault = true`로 조회한다. 없으면 `My Workspace`, `isDefault: true`, 해당 사용자 ID로 insert한다. 생성 결과가 없으면 오류를 발생시킨다. 기존 행이 있으면 그 행을 그대로 사용한다.

- [x] **Step 4: owner 멤버십을 idempotent하게 보정한다.**

  기본 워크스페이스와 사용자 ID를 사용해 owner 멤버십을 insert한다. 기존 unique 제약 충돌 시 중복을 만들지 않도록 conflict 처리하고, 기존 멤버십이 있다면 owner 역할을 유지·보정한다.

- [x] **Step 5: 테스트를 GREEN으로 전환한다.**

  Run: `pnpm --dir backend test -- tests/user-service.test.ts`

  Expected: 새 provisioning 테스트와 기존 사용자 서비스 테스트가 모두 통과한다.

---

## Task 3: 관리자용 테스트 사용자 스크립트 연결

**Files:**

- Modify: `backend/src/scripts/create-test-user.ts`

**Interfaces:**

- Consumes: `upsertUserWithDefaultWorkspace`
- Produces: 테스트 사용자 생성·갱신 시 기본 워크스페이스 자동 provisioning

- [x] **Step 1: 직접 DB 조작 import를 제거하고 provisioning 서비스를 사용한다.**

  `db`, `users` import를 제거하고 `upsertUserWithDefaultWorkspace`를 import한다. 비밀번호 해시 생성과 password schema 검증은 유지한다.

- [x] **Step 2: 기존 `main` 흐름에서 provisioning 서비스를 호출한다.**

  환경변수로 읽은 이메일·이름·해시된 비밀번호를 서비스에 전달한다. 기존 성공 로그와 process exit 흐름은 유지한다.

- [x] **Step 3: 스크립트의 타입·포맷을 확인한다.**

  Run: `pnpm --dir backend exec prettier --check src/scripts/create-test-user.ts src/services/user.service.ts tests/user-service.test.ts`

  실패하면 변경한 파일만 포맷한 뒤 다시 확인한다.

---

## Task 4: 실제 테스트 계정 보정

**Files:**

- Runtime data: configured database의 `test@example.com` 사용자

- [x] **Step 1: 구현 검증이 끝난 뒤 provisioning 스크립트를 실행한다.**

  Run: `pnpm --dir backend create-test-user`

  Expected: 기존 테스트 계정이 유지되고 기본 워크스페이스와 owner 멤버십이 생성된다. 스크립트는 idempotent하므로 재실행 시 기본 워크스페이스가 중복되지 않아야 한다.

- [x] **Step 2: 계정의 워크스페이스 목록을 API로 확인한다.**

  테스트 계정으로 로그인한 뒤 `GET /workspaces`를 호출해 `name = "My Workspace"`, `isDefault = true`, `role = "owner"`인 항목을 확인한다. 인증·실행 환경이 준비되지 않으면 실행 결과를 남기고 수동 확인 항목으로 기록한다.

- [x] **Step 3: 기본 워크스페이스 삭제 차단을 확인한다.**

  해당 workspace ID로 `DELETE /workspaces/:workspaceId`를 호출했을 때 `400 WORKSPACE_DEFAULT_DELETE_FORBIDDEN`이 반환되는지 확인한다. 기존 `backend/tests/workspace.test.ts`의 회귀 테스트도 함께 실행한다.

---

## Task 5: 전체 검증 및 계획 문서 결과 기록

- [x] **Step 1: 관련 테스트를 실행한다.**

  ```bash
  pnpm --dir backend test -- tests/user-service.test.ts tests/workspace.test.ts
  ```

- [x] **Step 2: 전체 백엔드 검증을 실행한다.**

  ```bash
  pnpm --dir backend test
  pnpm --dir backend lint
  pnpm --dir backend build
  pnpm --dir backend exec prettier --check src/services/user.service.ts src/scripts/create-test-user.ts tests/user-service.test.ts
  ```

- [x] **Step 3: 검증 결과와 계획 대비 차이를 이 문서 하단에 기록한다.**

  `Implementation Results`에 실제 변경 파일, 실행한 명령과 결과, 계획과 달라진 점, 남은 후속 작업을 기록한다.

- [x] **Step 4: 사용자가 별도로 요청하지 않았으므로 commit하지 않는다.**

---

## Implementation Results

구현이 완료되었다.

- 변경 내용: 사용자 upsert와 기본 워크스페이스·owner 멤버십 생성을 `user.service.ts`의 단일 transaction으로 구현하고, `create-test-user.ts`가 해당 서비스를 사용하도록 변경했다. provisioning 테스트 4개를 추가했다.
- 계획과 달라진 점: 코드와 범위는 계획대로 구현했다. 계획의 직접 DB 조회 단계는 실제 DB 조회와 로컬 API 확인으로 모두 검증했다.
- 실행한 검증 명령과 결과:
  - `pnpm --dir backend test -- tests/user-service.test.ts`: 8개 통과
  - `pnpm --dir backend test -- tests/user-service.test.ts tests/workspace.test.ts`: 38개 통과
  - `pnpm --dir backend test`: 20개 파일, 151개 테스트 통과
  - `pnpm --dir backend lint`: 통과
  - `pnpm --dir backend build`: 통과
  - 변경 파일 Prettier 검사: 통과
  - 로컬 API 확인: `GET /workspaces`에서 기본 워크스페이스를 확인하고 삭제 요청에서 `400 WORKSPACE_DEFAULT_DELETE_FORBIDDEN`을 확인
- `test@example.com` 실제 데이터 보정 결과: `My Workspace`, `isDefault: true`, `role: owner`가 생성되었고 스크립트 재실행 후 기본 워크스페이스 수가 1개로 유지되었다.
- 남은 후속 작업: 다른 기존 사용자에 대한 backfill은 이번 요구사항 범위에 포함하지 않았다.
