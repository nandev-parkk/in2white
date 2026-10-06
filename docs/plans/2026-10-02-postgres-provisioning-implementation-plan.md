# 기존 PostgreSQL 프로비저닝 구현 계획

- 설계: [2026-10-02-postgres-provisioning-design.md](../specs/2026-10-02-postgres-provisioning-design.md)
- 브랜치: `feat/postgres-provisioning`

1. 기존 PostgreSQL에 역할·DB를 생성하고 재실행할 수 있는 기대 동작을 통합 테스트로 작성한다. 스크립트가 없어서 실패하는 것을 확인한다.
2. `server/src/scripts/provision-database.ts`에 최소 구현을 추가한다. 관리자 URL은 이 명령에만 전달하고, 앱 URL의 계정으로 접속을 확인한다.
3. `.env.compose.example`과 `docs/deployment/docker-compose.md`에 일회성 명령과 관리자 URL 설정을 추가한다.
4. 관련 통합 테스트, 백엔드 lint·build·typecheck, Compose 설정 검사를 실행한다. 결과와 계획 차이를 이 문서에 기록한다.

## 완료 결과

- `server/src/scripts/provision-database.ts`를 추가했다. 관리자 연결로 없는 역할·DB를 생성하고, 기존 DB 소유자를 확인한 뒤 앱 연결을 검사한다.
- `.env.compose.example`과 배포 가이드에 일회성 초기 설정 명령을 추가했다. 관리자 URL은 평상시 `server` 서비스 환경에 포함하지 않았다.
- 테스트를 먼저 실행해 스크립트 부재로 실패함을 확인했다. 구현 후 `RUN_DATABASE_INTEGRATION_TESTS=1 pnpm --filter server exec vitest run tests/provision-database.integration.test.ts`가 통과했다.
- `pnpm --filter server test`, `lint`, `build`, `typecheck`, `docker compose --env-file .env.compose config --quiet`, server 이미지 빌드와 이미지 내 스크립트 확인이 모두 통과했다.
- 계획과의 차이: PostgreSQL `format()`의 인자 타입 추론 오류를 해결하기 위해 인자를 `::text`로 명시했다. 실제 운영 PostgreSQL 서버에 대한 초기 설정은 아직 실행하지 않았다.
