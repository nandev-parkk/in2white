# Docker Compose 배포 설계

## 목표

`frontend`와 `backend`를 각각 이미지로 빌드해 Docker Compose에서 함께 운영한다. PostgreSQL과 Valkey는 사용자가 선택한 외부 서비스에 연결한다. 프런트엔드는 컨테이너 빌드 단계에서 React 앱을 빌드하고 Nginx가 정적 파일을 제공한다.

## 구성과 동작

- `frontend/Dockerfile`: Node 24와 고정한 pnpm으로 `pnpm build`를 수행한 뒤 결과물만 Nginx 이미지로 복사한다. Nginx는 SPA 경로를 `index.html`로 돌린다.
- `backend/Dockerfile`: Node 24와 고정한 pnpm으로 의존성을 설치하고 TypeScript를 빌드한다. 이미지 기본 명령은 `node dist/server.js`다. `drizzle-kit`을 포함하여 같은 이미지에서 `./node_modules/.bin/drizzle-kit migrate`를 별도 실행한다.
- `docker-compose.yml`: `frontend`와 `backend` 두 서비스만 정의한다. 두 포트는 호스트의 loopback에 연결해 외부 TLS 프록시가 공개한다. DB·Valkey 컨테이너와 데이터 볼륨은 두지 않는다.
- `VITE_API_BASE_URL`은 프런트엔드 이미지 빌드 인자이며 브라우저에서 접근할 수 있는 API 주소다. `DATABASE_URL`, `VALKEY_URL`, JWT 비밀값 두 개, `CORS_ORIGIN`은 백엔드 런타임 환경 변수다.
- 로컬 `.env.compose`는 Compose의 값 공급원으로 사용하며 Git에 포함하지 않는다. 커밋되는 예시 파일에는 값의 형식만 기록한다. 각 빌드 컨텍스트의 `.dockerignore`는 실제 `.env`와 의존성·빌드 산출물을 제외한다.

## 연결과 오류 계약

- 외부 PostgreSQL·Valkey의 DNS, 인증, TLS, 네트워크 허용 목록은 운영 환경에서 준비한다. 연결 실패 시 백엔드 기능은 실패할 수 있으며 현재 `/health`는 이 연결을 검사하지 않는다.
- `CORS_ORIGIN`은 정확한 프런트엔드 origin이다. 프로덕션 refresh 쿠키(`Secure`, `SameSite=Lax`)를 고려해 프런트엔드와 API는 같은 사이트의 HTTPS 하위 도메인을 사용한다.
- Socket.IO와 HTTP API는 같은 백엔드 포트를 사용한다. 프록시는 polling과 WebSocket Upgrade를 모두 전달한다. 백엔드는 현재 한 인스턴스로 운영한다.
- 프런트엔드 빌드는 API 주소가 빠지면 실패하도록 한다. 백엔드 환경 변수는 애플리케이션의 기존 검증을 따른다. 마이그레이션은 서버 시작과 분리하여 실패 시 앱을 교체하지 않는다.

## 변경 범위

`frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`, 깨끗한 환경에서도 빌드되도록 조정한 `frontend/package.json`, `backend/Dockerfile`, `backend/.dockerignore`, 루트 `docker-compose.yml`, `.env.compose.example`, 예시 파일을 추적하기 위한 `.gitignore`, README와 배포 가이드, 이 설계 및 구현 계획 문서.

## 검증

Compose 구성 파싱, 두 이미지 빌드, 프런트엔드 컨테이너의 HTML 및 SPA 경로 응답, 백엔드 이미지의 실행 파일과 마이그레이션 CLI 존재 여부를 확인한다. 외부 DB·Valkey 자격 증명이 없으면 실제 로그인·마이그레이션 성공은 운영 환경에서 확인한다.
