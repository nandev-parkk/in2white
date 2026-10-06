# Docker 빌드 경로 변경 후 workspace 설치 실패

- 증상·검색어: 디렉터리를 `frontend/backend`에서 `client/server`로 옮긴 뒤 Compose 빌드는 없는 `frontend/` 경로를 찾거나, pnpm 설치는 `importers["server"]`가 없다고 실패한다.
- 원인: Dockerfile의 `COPY`·산출물 경로, Compose의 Dockerfile 경로, `pnpm-workspace.yaml`의 workspace 경로와 lockfile importer가 이전 디렉터리 구조를 가리킨다.
- 해결: Dockerfile·Compose·workspace 경로와 pnpm 매니페스트 이름·필터 및 Compose 서비스 이름을 `client/server`로 맞추고, `.gitignore` 경로 규칙도 `client/`에 맞췄다. `pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts`로 lockfile을 현재 workspace에 맞게 갱신한다.
- 검증: `docker compose --env-file .env.compose config --quiet`, `docker compose --env-file .env.compose config --services`, `git check-ignore --no-index client/src/routeTree.gen.ts`, `docker compose --env-file .env.compose build client admin server` 통과.
- 적용 조건: workspace 패키지의 디렉터리 경로를 옮긴 뒤 Docker 빌드 설정을 갱신할 때.

## 추가 증상: Docker 빌드 산출물 누락

- 증상·검색어: `COPY --from=build /app/client/dist`에서 경로가 없다고 실패한다.
- 원인: pnpm `--filter client`는 workspace 폴더가 아니라 매니페스트의 패키지 이름을 찾는다. 실제 이름은 `in2white-client`이며, 일치 대상이 없으면 빌드 명령이 산출물을 만들지 않고도 성공할 수 있다. `admin`·`server` 필터도 각각 `in2white-admin`·`in2white-server`와 불일치했다.
- 해결: 세 Dockerfile의 필터를 실제 패키지 이름에 맞추고 빌드 명령에 `--fail-if-no-match`를 넣어 대상이 없으면 즉시 실패시킨다.
- 검증: 잘못된 `pnpm --filter client --fail-if-no-match run build`는 대상 없음으로 실패했다. `docker compose build client admin server`, `docker compose up -d`, DB 마이그레이션이 통과했다.
- 적용 조건: pnpm 필터를 추가하거나 변경할 때 workspace 폴더명이 아닌 각 `package.json`의 `name`과 대조한다.
