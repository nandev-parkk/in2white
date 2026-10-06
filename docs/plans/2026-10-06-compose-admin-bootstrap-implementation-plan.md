# Compose DB 마이그레이션 및 초기 관리자 생성 구현 계획

## 작업

- [x] `admin-account.service`에 초기 관리자 존재 확인 함수를 추가하고 기존 테스트에 존재/미존재 케이스를 먼저 작성한다.
- [x] 환경 변수 검증, 기존 비밀번호 해시, 기존 관리자 생성 서비스를 재사용하는 일회성 bootstrap 스크립트를 추가한다.
- [x] Compose에 `db-migrate`와 `admin-bootstrap` 단계를 추가해 서버 시작 전에 순차 실행한다.
- [x] 초기 관리자 설정 키를 `.env.example`과 배포 가이드에 기록한다.
- [x] 관련 테스트, 타입 검사, Compose 구성과 서버 이미지 빌드를 검증한다.

## 구현 기록

`hasAdminUsers`를 추가하고 관리자 존재/미존재 테스트를 먼저 작성했다. 초기 관리자 스크립트는 기존 `createUserSchema`, `hashPassword`, `createAdminUser`를 재사용하며, 입력값은 bootstrap 서비스에만 전달한다. Compose dependency를 `db-provision → db-migrate → admin-bootstrap → server`로 연결했고 배포 가이드를 갱신했다. 실제 Compose 실행에서 pnpm 권한 오류를 확인해 migration 명령을 `./node_modules/.bin/drizzle-kit migrate` 직접 실행으로 수정했다.

## 계획 차이

서버와 bootstrap 서비스가 동일한 앱 환경 설정을 재사용하도록 Compose에 `x-server-environment` anchor를 추가했다. 별도 migration 실행 절차와 수동 초기 관리자 생성 절차는 Compose 자동 실행으로 대체했다. 최초 migration 명령은 pnpm을 사용했으나, 런타임 사용자와 설치 파일 소유자가 달라 CLI 직접 실행으로 변경했다.

## 검증 기록

- `pnpm --filter in2white-server exec vitest run tests/admin-account-service.test.ts` — 통과 (9 tests)
- `pnpm --filter in2white-server test` — 통과
- `pnpm --filter in2white-server typecheck` — 통과
- `pnpm --filter in2white-server lint` — 통과
- `pnpm --filter in2white-server exec prettier --check src/services/admin-account.service.ts src/scripts/bootstrap-admin-user.ts tests/admin-account-service.test.ts` — 통과
- `docker compose config --quiet` — 통과
- Compose dependency/command projection — `db-provision → db-migrate → admin-bootstrap → server` 확인
- `docker compose build server` — 통과
- `docker compose run --rm --no-deps db-migrate` — 통과, Compose PostgreSQL에 migration 적용
- `git diff --check` — 통과

## 후속 작업

첫 DB 초기화 전 `.env`에 `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_NAME`, `ADMIN_BOOTSTRAP_PASSWORD`를 설정해야 한다. 호스트 PostgreSQL의 기존 데이터를 Compose PostgreSQL로 복사하는 작업은 별도 범위다.
