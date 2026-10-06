# Docker Compose 배포 가이드

## 적용 범위와 현재 상태

프런트엔드(Vite 정적 파일), 어드민 콘솔(Vite 정적 파일), 백엔드(Express·Socket.IO), PostgreSQL, Valkey를 Docker Compose로 운영한다. TLS를 처리하는 리버스 프록시는 호스트에서 별도로 실행한다고 가정한다.

PostgreSQL과 Valkey는 Compose 내부 네트워크에만 연결하며 호스트 포트를 열지 않는다. TLS 리버스 프록시를 별도로 준비하고 아래의 앱 주소와 비밀값을 설정해야 배포할 수 있다.

## 구성

| 서비스 | 역할 | 컨테이너 포트 | 저장 데이터 |
| --- | --- | --- | --- |
| `client` | `pnpm build` 결과를 Nginx로 제공 | 80 | 없음 |
| `admin` | 어드민 콘솔 빌드 결과를 Nginx로 제공 | 80 | 없음 |
| `server` | `node dist/server.js`로 API와 Socket.IO 제공 | 10103 | PostgreSQL·Valkey 사용 |
| `postgres` | 앱 전용 DB를 제공 (`postgres:18`) | 5432 | `postgres_data` 볼륨 |
| `valkey` | 세션 저장소 제공 (`valkey/valkey:9.1.0-alpine`, AOF 활성화) | 6379 | `valkey_data` 볼륨 |
| `db-provision` | PostgreSQL 앱 역할·DB 준비 후 종료 | - | 없음 |

현재 Compose는 제품 화면(`10101`), 어드민 콘솔(`10102`), API(`10103`)를 호스트의 모든 인터페이스에 바인딩해 LAN 주소에서 접근할 수 있게 한다. 백엔드 컨테이너 내부 포트는 `10103`이다. `CORS_ORIGIN`과 `ADMIN_CORS_ORIGIN`은 각 화면을 여는 실제 주소로 맞춘다. 공개 도메인을 사용할 때는 실제 프록시 주소에 맞춰 브라우저용 API URL과 CORS 오리진을 설정한다.

## 이미지 구성

[`client/Dockerfile`](../../client/Dockerfile), [`admin/Dockerfile`](../../admin/Dockerfile), [`server/Dockerfile`](../../server/Dockerfile)은 모두 빌드 컨텍스트를 워크스페이스 루트로 두고 루트 잠금 파일로 의존성을 설치한다. 루트 [`.dockerignore`](../../.dockerignore)가 로컬 의존성, 빌드 결과, 실제 `.env`를 빌드 컨텍스트에서 제외한다.

- **프런트엔드:** Node 24와 pnpm 12.4.1로 컨테이너 안에서 `pnpm build`를 실행한다. `dist/`만 Nginx 이미지에 복사하며, [`nginx.conf`](../../client/nginx.conf)는 클라이언트 경로를 `index.html`로 돌린다.
- **어드민 콘솔:** 프런트엔드와 같은 방식이며 `pnpm --filter admin build` 결과를 제공한다. 공유 디자인 시스템 `packages/ui`를 함께 복사해 빌드한다.
- **백엔드:** Node 24와 pnpm 12.4.1로 `pnpm build`를 실행하고 `node dist/server.js`로 시작한다. 같은 이미지를 `db-provision`도 사용해 최초 시작 시 앱 전용 DB 계정·데이터베이스를 만든다. `drizzle-kit`과 마이그레이션 파일도 포함되어 있어 마이그레이션을 별도로 실행할 수 있다.

`VITE_API_BASE_URL`은 브라우저용 **빌드 시점** 값이다. `http://server:10103` 같은 Compose 내부 주소가 아니라 브라우저에서 접근할 수 있는 `https://api.example.com`을 사용한다. 주소가 바뀌면 해당 이미지를 다시 빌드해야 한다. 어드민 콘솔은 같은 값을 `ADMIN_VITE_API_BASE_URL`로 따로 받으며, 상단바 환경 배지 문구인 `ADMIN_ENVIRONMENT_LABEL`도 빌드 시점에 고정된다.

## Compose 구성

실제 설정은 [`docker-compose.yml`](../../docker-compose.yml)을 사용한다. 제품 화면(`10101`), 어드민 콘솔(`10102`), API(`10103`)는 호스트의 모든 인터페이스에 공개한다. PostgreSQL과 Valkey는 호스트 포트를 공개하지 않고 앱 컨테이너에서만 접근한다. 백엔드의 `/health`는 프로세스 응답만 확인하며 DB·Valkey 연결은 별도로 감시한다.

## 환경 변수와 비밀값

루트 [`.env.example`](../../.env.example)을 `.env`로 복사한 뒤 값을 채우면 Compose가 자동으로 읽는다. 루트 `.gitignore`는 `.env`와 `.env.*`를 제외한다. 파일 권한은 운영 계정만 읽도록 제한한다.

```dotenv
VITE_API_BASE_URL=https://api.example.com
CORS_ORIGIN=https://app.example.com
# openssl rand -hex 32로 생성. PostgreSQL의 관리자·앱 비밀번호는 유지해야 한다.
POSTGRES_ADMIN_PASSWORD=<임의 hex 값>
POSTGRES_APP_USER=in2white
POSTGRES_APP_PASSWORD=<임의 hex 값>
POSTGRES_APP_DATABASE=in2white
JWT_SECRET=<서로 다른 32자 이상의 임의 값>
JWT_REFRESH_SECRET=<서로 다른 32자 이상의 임의 값>
JWT_ADMIN_SECRET=<서로 다른 32자 이상의 임의 값>
JWT_ADMIN_REFRESH_SECRET=<서로 다른 32자 이상의 임의 값>
ADMIN_CORS_ORIGIN=https://admin.example.com
ADMIN_VITE_API_BASE_URL=https://api.example.com
ADMIN_ENVIRONMENT_LABEL=production
```

`CORS_ORIGIN`과 `ADMIN_CORS_ORIGIN`은 각각 제품 프런트엔드와 어드민 콘솔의 정확한 origin(스킴·호스트·포트) 하나를 지정한다. 네 개의 JWT 시크릿은 모두 서로 다른 값으로 만들며, 예를 들어 각각 `openssl rand -hex 32`로 생성할 수 있다. 값이 겹치면 백엔드가 부팅 단계에서 거부한다. PostgreSQL 비밀번호도 URL 안에 직접 들어가므로 `openssl rand -hex 32`로 생성해 URL 안전 문자를 사용한다. 이 비밀번호와 앱 계정·DB 이름은 PostgreSQL 볼륨을 유지하는 동안 바꾸지 않는다. 앱 URL은 Compose가 내부 서비스 이름으로 구성하며 관리자 URL은 일회성 프로비저닝 컨테이너에만 전달한다. `ADMIN_ENVIRONMENT_LABEL`은 어드민 상단바에 표시되는 문구다.

## 최초 배포와 업데이트

루트 [`.env.example`](../../.env.example)을 `.env`로 복사하고 앱 주소, PostgreSQL 비밀번호, JWT 비밀값을 설정한다. 새 DB에서 첫 관리자 계정을 자동 생성하려면 `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_NAME`, `ADMIN_BOOTSTRAP_PASSWORD`도 설정한다. 비밀번호는 제품 계정과 같은 정책(8~32자, 영문·숫자·특수문자 포함)을 따른다.

`docker compose up -d`가 다음 순서로 초기화한다.

1. `db-provision`: Compose PostgreSQL 안에 앱 전용 역할과 데이터베이스를 준비한다.
2. `db-migrate`: Drizzle이 아직 적용되지 않은 SQL migration을 앱 데이터베이스에 적용한다.
3. `admin-bootstrap`: 관리자 계정이 없으면 `.env`의 초기 계정 정보를 해시해 저장한다.
4. API 서버 시작

이미 관리자가 있으면 계정 생성은 건너뛰고 비밀번호도 변경하지 않는다. 관리자가 없는데 초기 계정 값이 빠졌거나 유효하지 않으면 bootstrap이 실패하고 API 서버도 시작하지 않는다. 이 절차는 호스트 PostgreSQL의 데이터를 복사하지 않으며 Compose의 `postgres_data` 볼륨을 사용한다.

```bash
docker compose config --quiet
docker compose build client admin server
docker compose up -d
docker compose ps
```

이후 관리자를 추가할 때는 기존 계정으로 어드민 콘솔에 로그인해 관리 화면에서 만든다. schema 변경이 있는 업데이트는 먼저 PostgreSQL을 백업한 뒤 새 이미지를 빌드하고 Compose를 다시 올린다. 이미 적용된 migration은 자동 롤백되지 않으므로 이전 앱 버전으로 되돌릴 때는 백업 복원 여부를 별도로 판단한다.

## TLS, 쿠키, Socket.IO

리버스 프록시에서 HTTPS를 종료하고 HTTP 요청을 HTTPS로 전환한다. 예를 들어 호스트의 Caddy를 사용한다면 다음과 같이 두 주소를 연결할 수 있다.

```caddyfile
app.example.com {
    reverse_proxy 127.0.0.1:10101
}

admin.example.com {
    reverse_proxy 127.0.0.1:10102
}

api.example.com {
    reverse_proxy 127.0.0.1:10103
}
```

Socket.IO는 백엔드 HTTP 서버의 `/socket.io/`를 사용한다. 프록시가 HTTP polling과 WebSocket Upgrade를 모두 전달해야 하며 경로를 변경하면 안 된다. Caddy의 `reverse_proxy`는 WebSocket을 지원한다. Nginx 등 다른 프록시를 사용하면 Upgrade·Connection 헤더와 HTTP/1.1 설정을 확인한다.

프로덕션 refresh 쿠키는 `Secure`, `SameSite=Lax`다. 위처럼 같은 사이트의 HTTPS 하위 도메인을 쓰면 브라우저의 인증 요청에 맞는다. 서로 다른 최상위 사이트를 사용하려면 쿠키·CORS 정책을 코드에서 다시 검토해야 한다.

## 데이터 보존과 롤백

PostgreSQL과 Valkey 데이터는 각각 `postgres_data`, `valkey_data` named volume에 저장된다. `docker compose down`은 데이터를 유지하고 `docker compose down -v`는 두 데이터 볼륨을 삭제한다. Valkey는 AOF를 사용하며 로그인 세션이 유실되면 사용자가 다시 로그인해야 할 수 있다. 이전 애플리케이션 버전으로 되돌릴 때 이미 적용한 DB 마이그레이션은 자동으로 되돌아가지 않으므로 백업 복원 여부를 별도로 판단한다.

현재 화이트보드 Room 상태는 백엔드 프로세스 메모리에 있으므로 백엔드는 **한 인스턴스**로 운영한다. 여러 인스턴스로 확장하려면 Room 상태와 Socket.IO 이벤트를 공유하도록 구현을 변경해야 한다.
