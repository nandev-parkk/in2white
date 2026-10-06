# 전체 API rate limit 구현 계획

설계: [HTTP·Socket.IO API별 rate limit 설계](../specs/2026-10-06-proxy-aware-rate-limit-design.md)

## 목표

IP당 15분 100회인 전역 제품 limiter를 없애고, 인증·조회·변경·관리자·실시간 요청을 각 요청 성격과 세션에 맞는 한도로 분리한다. 같은 공인 IP를 쓰는 기기들이 제품 API의 사용량을 서로 소모하지 않게 한다.

## 구현 범위

1. **회귀 테스트부터 작성한다.**
   - 같은 IP에서 서로 다른 제품 `sub:sid`가 조회·변경 한도를 독립적으로 사용하고, 같은 세션의 연속 요청은 429가 되는지 확인한다.
   - `/health`와 어드민 경로가 제품 제한 버킷에 들어가지 않는지 확인한다.
   - 제품·어드민 로그인에서 IP와 IP+정규화 이메일 제한을 각각 검증한다. 기존 어드민 IP당 10회/15분, JSON 429 본문을 고정한다.
   - 제품·어드민 refresh에서 검증 가능한 token의 `sub:sid`와 검증 불가 token의 IP fallback을 구분한다. 토큰 원문이 key·응답·로그에 노출되지 않는지 확인한다.
   - 성공한 login/password-change 2xx 응답은 실패 시도 버킷을 소모하지 않는지 확인한다.
   - 프록시를 신뢰하는 설정에서 전달 IP가 쓰이고, 설정되지 않은 경우 임의의 forwarding header를 클라이언트 IP로 받아들이지 않는지 확인한다.
   - Engine.IO 연결 수립 전 handshake 차단, 세션별 동시 연결 상한, join 초과를 검증하고 scene/presence의 기존 버킷 동작을 고정한다.
   - client query는 429를 자동 재시도하지 않는지 확인한다. 현재 공통 query 설정은 일반 실패를 한 번, 일부 프로젝트·멤버 query는 최대 두 번 재시도한다. admin query는 4xx 재시도를 이미 건너뛴다.

2. **신뢰 프록시 IP 판정을 설정한다.**
   - 서버 환경 schema에 0 이상의 `TRUST_PROXY_HOPS`를 추가하고 Express의 `trust proxy`에 적용한다. 기본값은 0으로 두며, 실제 배포가 Nginx 한 홉일 때 `.env`에서 1을 설정한다.
   - Socket.IO handshake는 Express `req.ip`를 재사용하지 않고, Engine.IO 요청에서 같은 신뢰 프록시 범위로 접속 IP를 구한다.
   - Compose는 이 키를 backend에 전달하고 `.env.example`에 키를 추가한다. 운영 `.env`에는 실제 proxy chain에 맞는 값을 설정한다.
   - 구현 전 테스트에서 Express가 `req.ip`를 선택하는 기준을 검증한다. 공개된 `10103`으로 직접 요청할 수 있으면 forwarding 헤더를 위조할 수 있으므로 배포 방화벽/보안 그룹에서 Nginx 외의 접근을 차단한다. Compose host bind 주소는 바꾸지 않는다.

3. **HTTP limiter를 범주별로 나눈다.**
   - `app.use(rateLimitMiddleware)` 전역 적용을 제거한다.
   - 인증 전 login/refresh와 인증 후 제품·어드민 요청에 별도 limiter를 배치한다. 제품 업무 요청은 검증된 `sub:sid`, 어드민 요청은 검증된 admin `sub:sid`를 키로 쓴다.
   - 업무 GET·검색에는 세션당 120회/분, 업무 변경에는 60회/분, 비밀번호 변경 실패에는 10회/15분을 적용한다. 관리자 조회·검색은 120회/분, 변경은 30회/분으로 둔다.
   - 기존 제품 429 응답 계약과 `RateLimit` 표준 헤더, 어드민 로그인 JSON 429 계약을 유지한다.

4. **429 재시도를 막는다.**
   - client의 기본 및 개별 query retry 정책에서 429를 재시도하지 않게 한다. 서버의 429를 받은 직후 같은 요청을 반복해 한도를 더 소모하지 않도록 한다.

5. **Socket.IO 제한을 보완한다.**
   - Engine.IO 연결 수립 전 IP 안전 상한을 분당 300회로 두고, 인증 실패는 IP당 60회/분, 유효 세션의 재연결은 `sub:sid`당 30회/분으로 나눈다. 인증된 세션의 동시 소켓은 최대 5개로 둔다.
   - `whiteboard:join`에 소켓별 초당 2회·burst 5회의 token bucket을 추가한다.
   - scene 20/40, presence 30/60 token bucket, 방 인원·payload 한도는 유지한다. 초과 응답은 기존 프로토콜 오류 모양을 따른다.

6. **오류 해결 기록을 남기고 검증한다.**
   - 구현 차이와 운영 전제, 검증 결과를 계획 문서에 기록하고 `docs/solutions/proxy-aware-api-rate-limits.md`에 원인·해결·적용 조건을 남긴다.
   - 관련 서버 테스트 후 전체 서버 테스트, lint, typecheck, build를 실행한다. Compose 전달 변수를 변경한 경우 `docker compose config --quiet`도 확인한다.

## 검증 명령

```sh
pnpm --filter in2white-server test
pnpm --filter in2white-server lint
pnpm --filter in2white-server typecheck
pnpm --filter in2white-server build
pnpm --filter in2white-client test
pnpm --filter in2white-client lint
pnpm --filter in2white-client build
docker compose config --quiet
```

## 구현 결과

- 제품·어드민 로그인은 실패 응답만 IP와 IP+정규화 이메일 버킷에 반영한다. 로그인 성공은 카운터를 소모하지 않으며 어드민 429 JSON 응답을 유지한다.
- 제품·어드민 조회와 변경, 비밀번호 변경, refresh를 인증 세션 `sub:sid` 기준 limiter로 분리했다. 서명 검증이 안 되는 refresh token은 IP 버킷으로 제한하고 토큰 원문은 키에 저장하지 않는다.
- `/health`와 CORS preflight는 앱 rate limit에서 제외했다. 전역 IP limiter는 제거했다.
- `TRUST_PROXY_HOPS`를 서버 환경 schema, Compose, `.env.example`에 추가했다. 기본값은 0이다. Socket.IO handshake도 같은 hop 수를 사용해 전달 IP를 해석한다.
- Socket.IO handshake IP 안전 상한, IP별 인증 실패 제한, 세션별 연결 시도·동시 연결 제한, join token bucket을 추가했다. scene/presence와 방 용량 제한은 유지했다.
- client 공통 query와 project/member 개별 retry에서 429는 다시 요청하지 않는다.

### 계획 차이와 운영 전제

- Socket.IO limiter는 기존 설치 코드 외 의존성을 추가하지 않고 프로세스 내 고정 윈도 카운터를 사용한다. IP·세션 키 저장소는 10,000개로 제한하며, 만료 항목을 정리해도 공간이 없으면 새 연결을 거부한다.
- HTTP limiter와 Socket.IO 카운터는 단일 backend 프로세스 기준이다. 여러 backend로 확장하기 전 Valkey 공유 store로 옮겨야 한다.
- Nginx 한 홉 뒤에서 운영할 때 `.env`의 `TRUST_PROXY_HOPS=1`을 설정한다. 실제 프록시 체인에 맞춰 조정하고, 공개 방화벽·보안 그룹에서 backend `10103` 직접 접근을 차단한다. Compose의 포트 바인딩은 변경하지 않았다.

### 검증 결과

- `pnpm --filter in2white-server test`: 61개 파일 통과, 956개 테스트 통과, 4개 파일·17개 테스트 skip.
- `pnpm --filter in2white-server typecheck`, `pnpm --filter in2white-server lint`, `pnpm --filter in2white-server build`: 통과.
- `pnpm --filter in2white-client test`: 446개 테스트 통과.
- `pnpm --filter in2white-client lint`, `pnpm --filter in2white-client build`: 통과. 빌드에 기존 500 kB 초과 chunk 경고가 출력된다.
- `docker compose config --quiet`: 통과.

### 남은 운영 작업

- Nginx 뒤에 배포할 때 전달 헤더를 실제 클라이언트 IP로 덮어쓰고, `.env`의 trusted hop 수를 배포 경로와 맞춘다.
- backend `10103` 포트의 외부 직접 접근을 방화벽·보안 그룹에서 제한한다. `TRUST_PROXY_HOPS`는 직접 접속자가 전달 헤더를 위조하는 일을 스스로 차단하지 않는다.
- 실제 429 발생률과 정상 사용량을 관찰한 뒤 초기 임계값을 조정한다.
