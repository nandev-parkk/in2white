# 사용자 기본 워크스페이스 자동 제공 설계

## 상태

승인됨

## 목표

사용자가 생성될 때 기본 워크스페이스 `My Workspace`와 해당 사용자의 `owner` 멤버십을 함께 만든다. 현재 유일한 사용자 생성 경로인 관리자용 `create-test-user` 스크립트를 통해 `test@example.com`의 누락된 기본 워크스페이스도 같은 규칙으로 보정한다.

## 배경

- `users`, `workspaces`, `workspace_memberships` 테이블은 이미 존재한다.
- `workspaces.is_default` 컬럼과 기본 워크스페이스 삭제 차단 로직이 이미 구현되어 있다.
- 현재 사용자 생성 경로는 회원가입 API가 아니라 `backend/src/scripts/create-test-user.ts`다.
- `test@example.com`은 이미 존재하지만 기본 워크스페이스가 없다.
- 제품 규칙상 모든 사용자는 최소 하나의 워크스페이스에 속해야 한다.

## 범위

### 포함

- 사용자 upsert와 기본 워크스페이스·owner 멤버십 생성을 하나의 DB 트랜잭션으로 묶는다.
- 새 사용자의 기본 워크스페이스를 다음 값으로 생성한다.
  - 이름: `My Workspace`
  - `isDefault`: `true`
  - `ownerId`: 생성된 사용자 ID
- 기존 사용자가 다시 provision될 때 기본 워크스페이스와 owner 멤버십을 누락된 경우에만 보정한다.
- `create-test-user`가 새 provisioning 서비스를 사용하도록 변경한다.
- `test@example.com`에 대해 provisioning 스크립트를 실행해 실제 데이터를 보정한다.
- 기본 워크스페이스가 기존 삭제 API에서 계속 삭제되지 않는지 검증한다.

### 제외

- 별도 회원가입 API 추가
- 모든 기존 사용자에 대한 일괄 마이그레이션
- 프론트엔드 변경
- 데이터베이스 스키마와 마이그레이션 변경
- 기본 워크스페이스의 이름 변경 정책 변경

## 설계

### Provisioning 서비스

`backend/src/services/user.service.ts`에 `upsertUserWithDefaultWorkspace`를 추가한다.

서비스는 다음 순서로 동작한다.

1. `users.email`을 기준으로 사용자를 insert하거나 기존 사용자의 이름·비밀번호를 update한다.
2. 반환된 사용자 ID로 `isDefault = true`인 소유 워크스페이스를 조회한다.
3. 기본 워크스페이스가 없으면 `My Workspace`를 생성한다.
4. 기본 워크스페이스의 사용자 멤버십을 `owner` 역할로 생성하거나 보정한다.
5. 사용자 upsert부터 멤버십 처리까지 모두 성공한 경우에만 트랜잭션을 완료한다.

사용자 upsert에 `ON CONFLICT DO UPDATE`를 사용하므로 기존 `test@example.com`을 다시 실행해도 사용자 ID를 유지하면서 누락된 리소스를 보정한다. 멤버십에는 기존 `(workspace_id, user_id)` unique 제약을 활용해 중복을 만들지 않는다.

### 삭제 불가 규칙

기존 `deleteWorkspace` 서비스가 `isDefault = true`를 확인하고 `400 WORKSPACE_DEFAULT_DELETE_FORBIDDEN`을 반환하므로 삭제 로직은 변경하지 않는다. 새로 생성되는 워크스페이스에 반드시 `isDefault = true`를 저장해 기존 보호 규칙과 연결한다.

### 데이터 흐름

```text
create-test-user
  -> upsertUserWithDefaultWorkspace
     -> users upsert
     -> default workspace 조회/생성
     -> owner membership 생성/보정
     -> transaction commit
```

## 파일 경계

- 수정: `backend/src/services/user.service.ts`
  - 사용자 조회 기능을 유지하고 provisioning 유스케이스를 추가한다.
- 수정: `backend/src/scripts/create-test-user.ts`
  - 직접 users 테이블을 조작하지 않고 provisioning 서비스를 호출한다.
- 수정: `backend/tests/user-service.test.ts`
  - 새 사용자 생성, 기존 사용자 보정, 중복 방지와 트랜잭션 계약을 검증한다.
- 검증: `backend/tests/workspace.test.ts`
  - 기존 기본 워크스페이스 삭제 차단 테스트를 통과시켜 새 데이터가 삭제 불가 규칙과 호환되는지 확인한다.
- 추가/수정 없음: `backend/src/db/schema`, `backend/src/db/migrations`
  - 필요한 컬럼, 외래키, 멤버십 unique 제약이 이미 있다.

## 오류 및 경계 조건

- 사용자 insert/upsert가 행을 반환하지 않으면 트랜잭션을 실패시킨다.
- 워크스페이스 insert가 행을 반환하지 않으면 트랜잭션을 실패시킨다.
- 사용자 생성 중 기본 워크스페이스 또는 멤버십 생성이 실패하면 전체 트랜잭션이 롤백된다.
- 이미 기본 워크스페이스가 있으면 이름을 `My Workspace`로 덮어쓰지 않는다. 기본 워크스페이스 이름 변경은 제품 규칙상 허용되기 때문이다.
- 현재 범위에서는 `test@example.com`만 실제 보정한다. 다른 기존 사용자에 대한 backfill은 수행하지 않는다.

## 테스트 전략

`backend/tests/user-service.test.ts`에서 기존 사용자 서비스 테스트와 동일한 Vitest mock 패턴을 사용한다.

필수 시나리오:

1. 새 사용자를 upsert하면 users, 기본 workspaces, owner membership이 같은 transaction에서 처리된다.
2. 기본 워크스페이스의 이름이 `My Workspace`이고 `isDefault`가 `true`다.
3. 이미 사용자가 있지만 기본 워크스페이스가 없으면 기존 사용자 ID로 기본 워크스페이스를 보정한다.
4. 이미 기본 워크스페이스가 있으면 새 워크스페이스를 만들지 않는다.
5. 기존 owner 멤버십은 중복 생성하지 않고, 누락된 멤버십을 보정한다.
6. 하위 insert가 실패하면 오류가 전파되어 트랜잭션이 실패한다.
7. 기존 workspace 테스트에서 기본 워크스페이스 삭제 시도가 계속 400으로 차단된다.

## 완료 기준

- 새 사용자 provisioning 경로가 기본 워크스페이스와 owner 멤버십을 자동으로 생성한다.
- `test@example.com`의 워크스페이스 목록에 `My Workspace`가 표시된다.
- 기본 워크스페이스 삭제 요청이 거부된다.
- 관련 테스트, 전체 백엔드 테스트, lint, build가 통과한다.
- 구현 계획 문서에 실제 변경 내용과 검증 결과를 기록한다.
