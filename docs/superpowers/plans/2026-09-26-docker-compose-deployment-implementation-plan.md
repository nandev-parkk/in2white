# Docker Compose 배포 구현 계획

## 목표와 전제

[설계 문서](../specs/2026-09-26-docker-compose-deployment-design.md)의 두 서비스 구성을 실제 배포 파일로 구현한다. 외부 PostgreSQL·Valkey 접속 정보와 TLS 프록시는 운영 환경에서 제공한다. 커밋·배포는 이 계획의 범위에 포함하지 않는다.

## 작업 1. 프런트엔드 이미지

1. `frontend/.dockerignore`로 로컬 의존성, 빌드 결과, `.env`를 제외한다.
2. `frontend/Dockerfile`에 Node 빌드 단계와 Nginx 실행 단계를 작성한다. `VITE_API_BASE_URL`이 없으면 빌드를 실패시킨다.
3. `frontend/nginx.conf`에서 Vite 결과물을 제공하고 클라이언트 라우트에 SPA fallback을 적용한다.
4. 이미지 빌드와 `/`, 임의 클라이언트 경로 응답으로 확인한다.

## 작업 2. 백엔드 이미지

1. `backend/.dockerignore`로 로컬 의존성, 결과물, `.env`를 제외한다.
2. `backend/Dockerfile`에서 의존성 설치·TypeScript 빌드 후 `pnpm start`를 실행한다. Git hook 설치를 억제하고 Drizzle 마이그레이션 실행에 필요한 파일과 개발 의존성을 유지한다.
3. 이미지 빌드와 `dist/server.js`, `drizzle-kit` 존재 여부를 확인한다. 외부 서비스 자격 증명 없이 실제 마이그레이션을 실행하지 않는다.

## 작업 3. Compose와 문서

1. 루트 `docker-compose.yml`에 frontend/backend와 loopback 포트, 빌드 인자, 런타임 환경 변수, 백엔드 프로세스 healthcheck를 작성한다.
2. `.env.compose.example`에 필요한 값과 비밀값 자리표시자를 적는다.
3. 배포 가이드의 예시 상태를 실제 파일 기준으로 바꾸고 README를 갱신한다. 외부 연결, 마이그레이션, 프록시, 백업 절차를 유지한다.
4. `docker compose config --quiet`, 두 이미지 빌드, 컨테이너 응답, `git diff --check`로 검증한다. 외부 DB·Valkey 연결과 인증 흐름은 운영 환경 후속 검증으로 남긴다.

## 권한·오류 계약

비밀값은 이미지와 Git에 포함하지 않는다. 프런트엔드 API 주소 누락, 백엔드 필수 환경 변수 누락, 외부 연결 실패는 조용히 무시하지 않는다. 마이그레이션 실패 시 백엔드 기동 단계로 진행하지 않는다.

## Implementation Results

### 실제 변경

- frontend 다단계 Dockerfile, SPA 경로용 Nginx 설정, 두 프로젝트의 `.dockerignore`를 추가했다.
- backend 이미지에 실행 파일·마이그레이션 도구를 포함하고 `node` 사용자로 실행하도록 했다.
- 외부 PostgreSQL·Valkey에 연결하는 두 서비스 `docker-compose.yml`과 `.env.compose.example`을 추가하고 배포 가이드·README를 실제 파일에 맞게 갱신했다.

### 계획과 달라진 점

- 새 작업 트리에는 Git 제외 대상인 `routeTree.gen.ts`가 없어 기존 `tsc -b && vite build`가 실패했다. Vite가 라우트 타입을 생성한 뒤 타입을 검사하도록 `frontend/package.json`의 빌드 순서를 변경했다.
- `node` 사용자로 실행한 pnpm CLI가 `node_modules` 수정을 시도해 권한 오류가 났다. 운영 마이그레이션은 이미지에 포함된 `./node_modules/.bin/drizzle-kit migrate`를 직접 호출하도록 문서화했다.
- `.env.compose.example`을 Git에서 추적하기 위해 `.gitignore` 예외를 추가했다.
- 사용자의 파일 위치 요청에 맞춰 변경을 현재 프로젝트 폴더의 기능 브랜치로 옮기고 Compose 파일명을 `docker-compose.yml`로 확정했다. 중복 작업 트리는 변경을 보존한 뒤 제거했다.

### 검증 명령과 결과

- `docker build --quiet --build-arg VITE_API_BASE_URL=https://api.example.com -t in2white-frontend:local ./frontend` — 성공. 최초 빌드는 라우트 타입 생성 순서 때문에 실패했고 수정 후 통과했다.
- `docker build --quiet -t in2white-backend:local ./backend` — 성공.
- 예시 외부 연결 값으로 `docker compose config --quiet` 및 `docker compose build --quiet frontend backend` — 성공. 서비스 목록은 `backend`, `frontend`만 포함했다.
- `docker run --rm --entrypoint nginx in2white-frontend:local -t` — 설정 검사 성공. 임시 프런트엔드 컨테이너의 `/`와 깊은 SPA 경로가 모두 HTTP 200을 반환했고 빌드 산출물에 API 주소가 포함됐다.
- 임시 백엔드 컨테이너의 `/health`가 HTTP 200을 반환했다. `./node_modules/.bin/drizzle-kit --version` 실행과 이미지 안의 `dist/server.js`·마이그레이션 파일 존재 확인이 성공했다.
- 문서 링크, Compose 변수와 예시 파일 대응, 공백 검사 및 `git diff --check`를 통과했다.
- 2026-09-28 Git 검증: `pnpm --dir frontend lint`는 오류 0건·경고 4건으로 종료 코드 0, `pnpm --dir backend lint`는 종료 코드 0이었다. `docker compose build --quiet frontend backend`와 두 이미지의 HTTP 응답 확인도 다시 통과했다.

### 남은 후속 작업

- 운영 외부 PostgreSQL·Valkey와 TLS 주소를 받은 뒤 실제 마이그레이션, 로그인, 화이트보드 Socket.IO 연결 및 백업·복원을 확인한다. 현재 검증에는 실서비스 자격 증명을 사용하지 않았다.
