# Task 1 실행 보고서: 프로젝트 삭제 상태 컬럼과 migration 추가

## 구현 내용

- `projects` Drizzle 테이블에 nullable `deletedAt` 컬럼을 추가했다.
- 컬럼 매핑은 `deletedAt: timestamp("deleted_at", { withTimezone: true })`이며 `default`와 `notNull()`을 사용하지 않았다.
- `projects.deleted_at` 추가를 위한 Drizzle migration과 snapshot/journal을 생성했다.
- 실제 데이터베이스에는 migration을 적용하지 않았다.

## 변경 파일

- `backend/tests/db-schema.test.ts`
  - `projects schema exposes a nullable deletedAt column` 테스트 추가
- `backend/src/db/schema/projects.ts`
  - `deletedAt` nullable timestamp 컬럼 추가
- `backend/src/db/migrations/0002_wandering_bruce_banner.sql`
  - `ALTER TABLE "projects" ADD COLUMN "deleted_at" timestamp with time zone;`
- `backend/src/db/migrations/meta/0002_snapshot.json`
  - `projects.deleted_at`을 `timestamp with time zone`, `notNull: false`로 기록
- `backend/src/db/migrations/meta/_journal.json`
  - migration index 2와 tag `0002_wandering_bruce_banner` 기록

## TDD RED/GREEN 증거

- RED: `pnpm --dir backend test -- tests/db-schema.test.ts`
  - 2개 테스트 중 1개 실패
  - `schema.projects.deletedAt`가 `undefined`라서 새 테스트가 실패
- GREEN: 동일 명령 재실행
  - Test Files 1 passed, Tests 2 passed

## Migration 생성 결과

- 실행: `pnpm --dir backend db:generate`
- 결과: `0002_wandering_bruce_banner.sql` 및 `0002_snapshot.json` 생성, journal 갱신 성공
- `pnpm --dir backend db:migrate`는 실행하지 않음

## 검증

- `pnpm --dir backend test -- tests/db-schema.test.ts` — PASS (2 tests)
- `pnpm --dir backend db:generate` — PASS
- `git diff --check` — PASS
- staged diff의 `git diff --cached --check` — PASS

## Self-review

- staged 변경은 Task 1 대상 소스·migration 5개와 이 실행 보고서로만 제한했다.
- 기존 untracked 설계 문서와 구현 계획 문서는 보존했고 staging하지 않았다.
- migration SQL은 `projects` 테이블의 nullable column 추가만 포함하며 파괴적 변경이나 unrelated schema 변경은 확인되지 않았다.
- `deletedAt`은 `updatedAt` 뒤에 배치했고 default/not-null 제약을 추가하지 않았다.

## Concern

- 생성된 Drizzle 파일의 마지막 newline 부재는 generator의 출력 형식이며 `git diff --check`에는 문제가 없었다.
- 실제 데이터베이스 migration 미적용은 brief의 요구사항에 따른 의도된 상태다.
