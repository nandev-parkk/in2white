# Docker Compose 배포 가이드

## 적용 범위와 현재 상태

프런트엔드(Vite 정적 파일)와 백엔드(Express·Socket.IO)를 Docker Compose로 운영하고, PostgreSQL과 Valkey는 외부 서비스에 연결하는 기준이다. TLS를 처리하는 리버스 프록시는 호스트에서 별도로 실행한다고 가정한다.

저장소의 `docker-compose.yml`은 두 앱 서비스만 정의한다. 외부 PostgreSQL·Valkey와 TLS 리버스 프록시를 준비하고 아래의 환경 변수를 설정해야 배포할 수 있다.

## 구성

| 서비스 | 역할 | 컨테이너 포트 | 저장 데이터 |
| --- | --- | --- | --- |
| `frontend` | `pnpm build` 결과를 Nginx로 제공 | 80 | 없음 |
| `backend` | `node dist/server.js`로 API와 Socket.IO 제공 | 4000 | 외부 PostgreSQL·Valkey 사용 |

예시 공개 주소는 `https://app.example.com`과 `https://api.example.com`이다. 호스트의 리버스 프록시가 각각 `127.0.0.1:8080`과 `127.0.0.1:4000`으로 전달한다. 두 주소는 실제 도메인으로 교체한다.

## 이미지 구성

[`frontend/Dockerfile`](../../frontend/Dockerfile)과 [`backend/Dockerfile`](../../backend/Dockerfile)은 각 프로젝트의 잠금 파일로 의존성을 설치한다. 두 `.dockerignore`는 로컬 의존성, 빌드 결과, 실제 `.env`를 빌드 컨텍스트에서 제외한다.

- **프런트엔드:** Node 24와 pnpm 12.4.1로 컨테이너 안에서 `pnpm build`를 실행한다. `dist/`만 Nginx 이미지에 복사하며, [`nginx.conf`](../../frontend/nginx.conf)는 클라이언트 경로를 `index.html`로 돌린다.
- **백엔드:** Node 24와 pnpm 12.4.1로 `pnpm build`를 실행하고 `node dist/server.js`로 시작한다. 같은 이미지에 `drizzle-kit`과 마이그레이션 파일을 두어 `./node_modules/.bin/drizzle-kit migrate`를 별도로 실행할 수 있다.

`VITE_API_BASE_URL`은 브라우저용 **빌드 시점** 값이다. `http://backend:4000` 같은 Compose 내부 주소가 아니라 브라우저에서 접근할 수 있는 `https://api.example.com`을 사용한다. 주소가 바뀌면 프런트엔드 이미지를 다시 빌드해야 한다.

## Compose 구성

실제 설정은 [`docker-compose.yml`](../../docker-compose.yml)을 사용한다. 프런트엔드는 호스트 `127.0.0.1:8080`, 백엔드는 `127.0.0.1:4000`으로만 공개한다. 외부 PostgreSQL·Valkey 주소는 백엔드 환경 변수로 전달한다. 백엔드의 `/health`는 프로세스 응답만 확인하며 외부 서비스 연결을 검사하지 않으므로 연결 상태는 별도로 감시한다.


## 환경 변수와 비밀값

루트 [`.env.compose.example`](../../.env.compose.example)을 `.env.compose`로 복사한 뒤 모든 값을 채우고 `docker compose --env-file .env.compose`로 사용한다. 루트 `.gitignore`는 `.env.*`를 제외한다. 파일 권한은 운영 계정만 읽도록 제한한다.

```dotenv
VITE_API_BASE_URL=https://api.example.com
CORS_ORIGIN=https://app.example.com
DATABASE_URL=<외부 PostgreSQL 연결 URL>
VALKEY_URL=<외부 Valkey 연결 URL>
JWT_SECRET=<서로 다른 32자 이상의 임의 값>
JWT_REFRESH_SECRET=<서로 다른 32자 이상의 임의 값>
```

`CORS_ORIGIN`은 프런트엔드의 정확한 origin(스킴·호스트·포트) 하나를 지정한다. `JWT_SECRET`과 `JWT_REFRESH_SECRET`은 서로 다른 값으로 만들며, 예를 들어 각각 `openssl rand -hex 32`로 생성할 수 있다. `DATABASE_URL`과 `VALKEY_URL`은 외부 서비스 제공자가 발급한 주소를 사용한다. DB 비밀번호에 URL 특수 문자가 있으면 URL 안의 비밀번호를 인코딩한다. 컨테이너에서 외부 서비스의 DNS와 네트워크 접근이 가능해야 하며, TLS·접근 허용 목록·인증서 설정은 제공자 지침에 맞춘다.

## 최초 배포와 업데이트

아래 명령은 `.env.compose`를 채운 다음 실행한다. 외부 PostgreSQL·Valkey를 준비하고, 컨테이너가 두 서비스에 접근할 수 있도록 허용한 뒤 DNS·TLS 리버스 프록시를 설정한다.

```bash
docker compose --env-file .env.compose config --quiet
docker compose --env-file .env.compose build frontend backend
docker compose --env-file .env.compose run --rm backend ./node_modules/.bin/drizzle-kit migrate
docker compose --env-file .env.compose up -d backend frontend
docker compose --env-file .env.compose ps
```

스키마 변경이 있는 업데이트는 먼저 외부 PostgreSQL을 백업하고, 해당 릴리스의 마이그레이션이 이전 버전과 호환되는지 확인한 뒤 같은 순서로 빌드·마이그레이션·재시작한다. 마이그레이션은 서버 시작 시 자동 실행되지 않는다.

배포 후에는 `curl -fsS https://api.example.com/health`로 API 응답을 확인하고, 프런트엔드에서 로그인과 화이트보드의 실시간 연결까지 확인한다. `/health` 성공만으로 DB·Valkey 또는 Socket.IO가 정상이라는 결론을 내릴 수 없다. 로그는 `docker compose --env-file .env.compose logs -f backend frontend`로 확인한다.

## TLS, 쿠키, Socket.IO

리버스 프록시에서 HTTPS를 종료하고 HTTP 요청을 HTTPS로 전환한다. 예를 들어 호스트의 Caddy를 사용한다면 다음과 같이 두 주소를 연결할 수 있다.

```caddyfile
app.example.com {
    reverse_proxy 127.0.0.1:8080
}

api.example.com {
    reverse_proxy 127.0.0.1:4000
}
```

Socket.IO는 백엔드 HTTP 서버의 `/socket.io/`를 사용한다. 프록시가 HTTP polling과 WebSocket Upgrade를 모두 전달해야 하며 경로를 변경하면 안 된다. Caddy의 `reverse_proxy`는 WebSocket을 지원한다. Nginx 등 다른 프록시를 사용하면 Upgrade·Connection 헤더와 HTTP/1.1 설정을 확인한다.

프로덕션 refresh 쿠키는 `Secure`, `SameSite=Lax`다. 위처럼 같은 사이트의 HTTPS 하위 도메인을 쓰면 브라우저의 인증 요청에 맞는다. 서로 다른 최상위 사이트를 사용하려면 쿠키·CORS 정책을 코드에서 다시 검토해야 한다.

## 데이터 보존과 롤백

PostgreSQL 백업·복원과 Valkey 지속성은 외부 서비스 제공자의 설정 및 운영 절차를 따른다. Valkey에는 로그인 세션이 저장되므로 지속성이 꺼지거나 데이터가 유실되면 사용자가 다시 로그인해야 할 수 있다. Compose에는 데이터 볼륨이 없다. 이전 애플리케이션 버전으로 되돌릴 때는 해당 릴리스 이미지를 다시 배포하고, 이미 적용한 DB 마이그레이션은 자동으로 되돌아가지 않으므로 외부 PostgreSQL 백업 복원 여부를 별도로 판단한다.

현재 화이트보드 Room 상태는 백엔드 프로세스 메모리에 있으므로 백엔드는 **한 인스턴스**로 운영한다. 여러 인스턴스로 확장하려면 Room 상태와 Socket.IO 이벤트를 공유하도록 구현을 변경해야 한다.
