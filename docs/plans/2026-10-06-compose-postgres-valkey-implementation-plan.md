# Compose PostgreSQL·Valkey 구현 계획

- 설계: [2026-10-06-compose-postgres-valkey-design.md](../specs/2026-10-06-compose-postgres-valkey-design.md)

1. Compose에 `client`·`server` 서비스와 PostgreSQL·Valkey, healthcheck, 영속 볼륨, 일회성 DB 프로비저닝을 추가하고 서버 시작 조건을 연결한다.
2. 환경 예시와 배포 가이드에서 외부 DB·Valkey 연결 설정을 내부 서비스 구성으로 바꾼다.
3. 실제 `.env.compose`의 기존 앱 설정을 보존하면서 필요한 로컬 DB 비밀번호를 설정한다.
4. Compose 설정·이미지·서비스 의존 관계를 검증하고 컨테이너는 시작하지 않는다.

## 완료 결과

- `docker-compose.yml`에서 앱 서비스를 `client`·`server`로 통일하고 PostgreSQL 18과 Valkey 9.1.0 Alpine, named volume, healthcheck, 앱 전용 DB 프로비저닝 및 시작 의존 조건을 연결했다.
- `.env.compose.example`, 로컬 `.env.compose`, `docs/deployment/docker-compose.md`를 내부 DB·Valkey 구성에 맞췄다. 로컬 비밀번호는 임의 hex 값으로 설정했고 기존 JWT·앱 URL 설정은 보존했다.
- `docker compose --env-file .env.compose config --quiet` 통과. `config --images`에서 `postgres:18`, `valkey/valkey:9.1.0-alpine` 확인.
- Compose 렌더링 결과에서 DB·Valkey 호스트 포트가 비어 있고, `postgres_data`·`valkey_data` 볼륨과 `server`의 `db-provision` 완료·Valkey healthcheck 의존 조건을 확인했다.
- 회귀 확인: 변경 전 Compose 서비스 목록은 `frontend`·`backend`였고, `client/src/routeTree.gen.ts`는 ignore 규칙에 걸리지 않았다. 변경 후 `config --services`에 `client`·`server`가 나오며 `git check-ignore --no-index client/src/routeTree.gen.ts`가 통과한다.
- 계획과 차이: 없음. 검증은 정적 Compose 설정만 수행했으며 컨테이너는 시작하지 않았다.

## 후속 변경: 기본 환경 파일명 사용

- 사용자가 Compose 기본 파일명을 요청해 로컬 `.env.compose`를 `.env`로 옮기고, 추적 예시를 `.env.compose.example`에서 `.env.example`로 바꿨다. `.gitignore` 예외와 배포 가이드 명령도 자동 탐색에 맞췄다.
- 기본 파일 탐색 검증: `docker compose config --quiet` 통과. `.env`는 Git 및 Docker 빌드 컨텍스트에서 제외되며 `.env.example`만 추적한다.
- 컨테이너는 시작하지 않았다.

## 후속 수정: Docker 빌드 필터

- 실제 패키지 이름이 `in2white-client`, `in2white-admin`, `in2white-server`인데 Dockerfile 필터는 폴더 이름만 사용해 매치되지 않았다. pnpm이 선택 항목 없이 성공 종료하여 `client/dist`가 없고 최종 `COPY`가 실패했다.
- 세 Dockerfile의 설치·빌드 필터를 패키지 이름으로 바꾸고 빌드에는 `--fail-if-no-match`를 추가했다.
- 검증: 잘못된 client 필터의 대상 없음 실패를 확인한 뒤 `docker compose build client admin server` 성공. `docker compose up -d` 성공, `drizzle-kit migrate` 완료, client/admin/server 및 PostgreSQL·Valkey 컨테이너 실행 확인.
