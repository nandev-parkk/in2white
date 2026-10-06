# HTTP·Socket.IO API별 rate limit 설계

## 문제와 확인된 현재 동작

서버의 제품 limiter가 IP당 15분 100회로 설정돼 있고, `app.use(rateLimitMiddleware)`가 모든 라우터보다 먼저 실행된다. 따라서 `/health`, 제품 인증·업무 API, `/admin` 요청이 모두 같은 IP 버킷을 사용한다. `/auth/refresh`를 포함한 특정 경로의 별도 제한은 없다. 노트북과 태블릿이 같은 공인 IP를 공유하면 서로의 모든 API 요청이 같은 100회 한도를 소모한다.

어드민 로그인은 IP당 15분 10회 제한이 추가로 있지만, 전역 제품 제한도 함께 소모한다. 어드민 로그인 429는 `{ error: { code, message } }` JSON 계약이 있으므로 유지한다. 현재 Express는 프록시를 신뢰하도록 설정되지 않았다. Nginx의 `X-Forwarded-For: $remote_addr`를 `req.ip`에 반영하려면 Nginx만 신뢰하도록 설정하고, 공개 경로에서 백엔드 `10103` 포트로 직접 접근해 전달 헤더를 위조할 수 없게 해야 한다.

Socket.IO는 인증된 연결만 받는다. `whiteboard:scene:update`는 소켓별 초당 20회·burst 40회, `whiteboard:presence:update`는 소켓별 초당 30회·burst 60회 제한이 있다. handshake와 `whiteboard:join`에는 요청 빈도 제한이 없다. 방의 참가자·소켓 수 제한과 payload 크기 제한은 별도로 이미 적용돼 있다.

## 설계 목표

- 정상적인 서로 다른 로그인 세션이 같은 IP를 사용해도 제품 요청 한도를 공유하지 않는다. access/refresh 토큰에는 `sub`와 로그인별 `sid`가 있으므로 인증된 요청은 `sub:sid`를 버킷 키로 쓴다.
- 로그인·잘못된 refresh token처럼 인증 전 요청은 IP를 기준으로 제한한다. 로그인에는 계정 식별자와 IP 조합의 보조 버킷도 둔다.
- 모든 HTTP 경로를 요청 유형에 따라 분류한다. 공통 저한도 IP 버킷은 제거한다.
- 현재 429 응답 계약과 `RateLimit` 표준 헤더를 유지한다. 임계값은 운영 초기값이며 실제 429 빈도와 정상 트래픽을 보고 조정한다.
- 단일 backend 인스턴스를 전제로 기존 in-memory store를 사용한다. backend를 여러 인스턴스로 늘릴 때는 Valkey 등 공유 store로 전환해야 한다.

## 제안 정책

HTTP 윈도우는 명시한 고정 윈도우 기준이다. 로그인과 비밀번호 검증은 비용이 큰 인증 시도이므로 업무 요청 한도와 별도 버킷을 사용한다.

| API 범주 | 경로 | 버킷 키 | 제안 한도 | 비고 |
| --- | --- | --- | --- | --- |
| 상태 확인 | `GET /health/` | 없음 | 앱 limiter 제외 | 외부 모니터링의 상태 확인이 사용자 API 한도를 소모하지 않게 한다. 네트워크 단위 차단은 별도 운영 계층 책임이다. |
| 제품 로그인 | `POST /auth/login` | IP, 그리고 IP+정규화 이메일 | 실패 응답 IP당 60회/15분, 조합당 5회/15분 | 두 버킷을 모두 적용한다. 2xx 로그인 성공은 세지 않는다. 잘못된 입력과 인증 실패는 센다. 이메일만으로 제한해 제삼자가 특정 계정을 잠그는 구조는 피한다. |
| 제품 refresh | `POST /auth/refresh` | 서명 검증된 refresh token의 `sub:sid`; 검증 불가·누락 시 IP | 세션당 30회/15분, IP fallback 60회/15분 | 모든 요청을 센다. 토큰 원문은 버킷 키나 로그에 쓰지 않는다. 회전·동시 요청 여유를 두고, 잘못된 토큰은 IP 버킷에 귀속한다. |
| 제품 로그아웃 | `POST /auth/logout` | 인증된 `sub:sid` | 60회/분 | 인증된 변경 요청 기본 한도 적용. |
| 제품 조회 | `/account`, `/workspaces`, `/projects`, `/whiteboard-documents`, `/members`의 `GET` | 인증된 `sub:sid` | 세션당 120회/분 | 목록·검색을 포함한다. 조회는 다른 기기의 세션과 한도를 공유하지 않는다. 클라이언트의 조회 cache는 60초이고 주기 polling은 없다. |
| 제품 변경 | 계정·workspace·project·whiteboard document·member의 `POST`, `PATCH`, `DELETE` | 인증된 `sub:sid` | 세션당 60회/분 | 모든 생성·수정·삭제 경로를 포함한다. |
| 비밀번호 변경 | `PATCH /account/password` | 인증된 `sub:sid` | 실패 응답 세션당 10회/15분 | 로그인 실패와 분리해 비밀번호 해시 검증 남용을 줄인다. 성공 응답은 세지 않는다. |
| 어드민 로그인 | `POST /admin/auth/login` | IP, 그리고 IP+정규화 이메일 | 실패 응답 IP당 10회/15분, 조합당 5회/15분 | 기존 IP당 10회 기준을 실패 요청에 적용하고 계정별 보조 버킷을 둔다. 2xx 로그인 성공은 세지 않는다. 기존 JSON 429 응답과 표준 헤더를 유지한다. |
| 어드민 refresh | `POST /admin/auth/refresh` | 서명 검증된 admin refresh token의 `sub:sid`; 검증 불가·누락 시 IP | 세션당 30회/15분, IP fallback 60회/15분 | 제품 refresh와 별도 공간을 사용한다. |
| 어드민 인증 조회 | `/admin/auth/me`, dashboard, system status, audit logs 및 목록·상세 `GET` | 인증된 admin `sub:sid` | 세션당 120회/분 | 검색 입력도 이 한도 안에서 동작한다. 어드민 로그인·refresh 요청은 이 그룹에 포함하지 않는다. |
| 어드민 변경 | 사용자·workspace·project·whiteboard document의 생성·수정·삭제·복구·상태 변경 | 인증된 admin `sub:sid` | 세션당 30회/분 | 비밀번호 재설정, 세션 폐기, 소유자 이전을 포함한다. |

`/auth/logout`과 어드민 logout은 인증된 변경 요청 그룹을 따른다. CORS preflight는 기존 middleware 순서대로 limiter보다 먼저 처리한다. 분류되지 않은 요청이 정상 API 요청의 한도를 소모하지 않도록 전역 제품 IP limiter는 두지 않는다.

### Socket.IO

| 대상 | 버킷 키 | 제안 정책 | 비고 |
| --- | --- | --- | --- |
| handshake 안전 상한 | 클라이언트 IP | 분당 300회 | Engine.IO `allowRequest` 등 연결 수립 전 단계에서 제한한다. 여러 사용자가 같은 NAT를 쓰는 경우를 위해 상한을 넉넉히 둔다. Socket.IO 주소에는 Express `req.ip`가 자동 적용되지 않으므로, HTTP와 같은 Nginx 신뢰 경계로 전달 IP를 해석한다. |
| handshake 인증 실패 | 클라이언트 IP | 분당 60회 | JWT 검증 실패에 적용한다. 정상 사용자 연결 시도는 세션 버킷으로 제한한다. |
| 인증된 연결 시도 | 검증된 `sub:sid` | 세션당 30회/분 | 세션별 재연결 폭주를 제한한다. |
| 동시 연결 | 검증된 `sub:sid` | 세션당 최대 5개 소켓 | 탭·기기 연결 폭주와 다중 소켓으로 인한 소켓별 한도 우회를 줄인다. 연결이 끊기면 자리를 반환한다. |
| `whiteboard:join` | 소켓별 token bucket | 초당 2회, burst 5회 | 문서 접근 확인과 DB 조회를 반복 호출하지 못하게 한다. 초과 시 기존 ack 오류 형태로 `RATE_LIMITED`를 돌려준다. |
| `whiteboard:scene:update` | 소켓별 token bucket | 현재 값 유지: 초당 20회, burst 40회 | 초과 시 현재 `RATE_LIMITED` ack를 유지한다. |
| `whiteboard:presence:update` | 소켓별 token bucket | 현재 값 유지: 초당 30회, burst 60회 | 초과 시 현재 오류 이벤트를 유지한다. |

방당 참가자 30명, 소켓 60개, payload byte 제한은 빈도 제한과 다른 용량 제한으로 유지한다.

## 프록시·저장소 경계

- `req.ip`는 Nginx가 전달한 실제 접속 IP를 사용하도록 신뢰 프록시를 명시한다. 배포 경로가 Nginx 한 홉인 경우에만 그 한 홉을 신뢰하고, 여러 홉이면 실제 체인에 맞춰 신뢰 범위를 정한다.
- Socket.IO handshake는 Express `req.ip`를 공유하지 않으므로 별도 IP 해석 경로에도 같은 프록시 신뢰 범위를 적용한다.
- Compose가 backend의 `10103` 포트를 공개하므로 방화벽·보안 그룹에서 인터넷의 직접 접근을 막고 Nginx 경유만 허용한다. 이 제한 없이는 직접 요청자가 forwarding 헤더를 위조할 수 있다. Compose의 host bind 주소는 임의로 변경하지 않는다.
- 현재 limiter는 프로세스 내부 store다. 단일 backend에는 충분하지만 재시작 때 카운터가 초기화되고 복수 backend 간 카운터를 공유하지 않는다. 수평 확장 전 공유 Valkey store를 도입한다.

## 오류·호환성 계약

- 기존 제품 API의 429 본문 계약과 `RateLimit` 표준 헤더를 유지한다.
- 어드민 로그인 429의 JSON `{ error: { code, message } }`와 `RATE_LIMIT_EXCEEDED` 코드를 유지한다.
- client는 429를 자동 재시도하지 않는다. 현재 공통 query 설정과 일부 개별 query가 4xx도 재시도해 제한 초과 요청을 더 늘릴 수 있다. admin은 이미 4xx 재시도를 건너뛴다.
- refresh rate limit은 refresh token을 갱신하거나 폐기하지 않는다. limiter에서 막힌 요청은 기존 401 refresh 처리와 혼동되지 않는 429를 반환한다.
- Socket.IO handshake 차단은 연결 수립 단계에서 처리한다. 연결 후 이벤트의 `RATE_LIMITED` 오류 계약은 유지한다.
- Socket.IO의 기존 `RATE_LIMITED` 오류 계약을 유지한다.

## 검증 기준

- 같은 IP의 서로 다른 `sub:sid`는 각자 제품 조회·변경 한도를 가진다. 한 `sid`의 반복 요청은 해당 그룹 한도를 넘으면 429가 된다.
- 제품·어드민 로그인은 IP 및 정규화 이메일+IP 버킷을 각각 적용한다. refresh는 검증된 세션 키와 invalid-token IP fallback을 구분한다.
- 성공한 로그인·비밀번호 변경은 실패 시도 한도를 소모하지 않고, 429 응답을 받은 client query는 자동 재시도하지 않는다.
- health 요청은 앱 limiter에 포함되지 않고, 어드민 경로가 제품 버킷을 소모하지 않는다.
- 신뢰된 Nginx의 forwarding IP는 사용되고, 직접 접근/위조 헤더는 배포 네트워크 제한 또는 신뢰 프록시 테스트로 차단된다. Socket.IO의 NAT 상한은 분당 300회로 설정하고, 정상 인증 세션별 연결 시도·동시 연결 제한을 별도 검증한다.
- 어드민 JSON 429, 제품 429, HTTP `RateLimit` 헤더 및 Socket.IO `RATE_LIMITED` 응답 계약이 유지된다.
