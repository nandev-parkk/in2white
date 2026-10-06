# 프록시 뒤 API rate limit이 공유 IP에서 사용자 요청을 막는 문제

## 증상과 검색 키워드

- 같은 공인 IP를 사용하는 여러 기기에서 `/auth/refresh` 또는 다른 API 요청이 `429 Too Many Requests`를 받는다.
- 키워드: `429`, `express-rate-limit`, `req.ip`, `X-Forwarded-For`, Socket.IO handshake

## 근본 원인

전역 IP limiter 하나가 `/health`, 인증, 제품 API, 어드민 API 요청을 모두 셌다. 같은 NAT를 사용하는 세션들이 한 버킷을 공유했고, Express는 프록시를 신뢰하지 않아 기본적으로 프록시 주소를 `req.ip`로 사용했다. client query의 자동 재시도는 429 요청을 더 반복할 수 있었다.

## 해결

- 전역 limiter를 제거하고 로그인·refresh·인증된 조회·변경·비밀번호 변경을 별도 버킷으로 나눴다. 로그인과 비밀번호 변경 제한은 성공 응답을 카운트에서 제외한다.
- 로그인은 IP 및 IP+정규화 이메일을 함께 제한한다. 서명이 유효한 refresh token은 `sub:sid`로, 누락·잘못된 token은 IP로 제한한다. token 원문은 버킷 키에 보관하지 않는다.
- 인증된 제품·어드민 API는 세션별 조회·변경 한도를 사용한다. `/health`와 CORS preflight는 앱 limiter에서 제외한다.
- `TRUST_PROXY_HOPS`를 Express와 Socket.IO의 IP 해석에 사용한다. 기본값은 `0`이다. 실제 프록시 경로와 일치할 때만 설정한다.
- Socket.IO에는 handshake IP 안전 상한, 인증 실패 IP 제한, 세션별 연결 시도와 동시 소켓 제한, `whiteboard:join` token bucket을 추가했다.
- client query는 HTTP 429를 자동 재시도하지 않는다.

관련 구현은 `server/src/middlewares/rate-limit.middleware.ts`, `server/src/app.ts`, `server/src/realtime/whiteboard-collaboration.ts`, `client/src/shared/api/query-client.ts`에 있다.

## 검증

- `pnpm --filter in2white-server test`: 956개 테스트 통과, 17개 skip.
- `pnpm --filter in2white-server typecheck`, `lint`, `build`: 통과.
- `pnpm --filter in2white-client test`: 446개 테스트 통과.
- `pnpm --filter in2white-client lint`, `build`, `docker compose config --quiet`: 통과.

## 적용 조건과 재발 방지

- Nginx 한 홉 뒤에 배포할 때 운영 `.env`에 `TRUST_PROXY_HOPS=1`을 설정한다. Nginx는 `X-Forwarded-For`를 실제 접속 IP로 덮어써야 한다.
- backend `10103` 포트의 외부 직접 접속을 방화벽·보안 그룹으로 막는다. 프록시 hop 수만 설정하면 직접 요청의 전달 헤더 위조를 막지 못한다.
- 현재 HTTP limiter는 `express-rate-limit`의 프로세스 내 store를, Socket.IO limiter는 프로세스 내 고정 윈도 카운터를 사용한다. 단일 backend 전제다. 여러 backend로 확장하기 전에 Valkey 공유 store를 적용한다.
- 임계값은 초기값이다. 정상 사용자의 429 발생률과 인증 시도량을 확인해 조정한다.
