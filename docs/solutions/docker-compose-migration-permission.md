# Compose 마이그레이션에서 pnpm 권한 오류

- 증상·검색어: `docker compose up -d`의 `db-migrate`가 `ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR`와 `/app/node_modules/.modules.yaml` 접근 거부로 종료된다.
- 원인: Docker 이미지 빌드 단계는 root로 pnpm 의존성을 설치하지만, 런타임은 `node` 사용자로 실행한다. 마이그레이션 단계에서 pnpm을 다시 실행하면 workspace 설치 상태를 갱신하려다가 root 소유 `node_modules`를 수정하지 못한다.
- 해결: pnpm을 런타임에 호출하지 않고, 이미지에 설치된 Drizzle CLI를 `./node_modules/.bin/drizzle-kit migrate`로 직접 실행한다. 실행 작업 디렉터리는 `/app/server`다.
- 검증: `docker compose config --quiet`, `docker compose run --rm --no-deps db-migrate` 통과.
- 적용 조건: workspace 의존성은 이미지 빌드 시 설치하고 런타임 사용자는 `node`인 현재 Dockerfile 구성. 나중에 프로덕션 이미지에서 `drizzle-kit`을 제외한다면 CLI가 포함된 별도 migration 이미지를 사용한다.
