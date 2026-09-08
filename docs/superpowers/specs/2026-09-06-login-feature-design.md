# 로그인 기능 (백엔드) 설계

- 관련 문서: [`PRODUCT.md`](../../../PRODUCT.md) §"로그인/로그아웃", [`2026-09-05-backend-scaffolding-design.md`](./2026-09-05-backend-scaffolding-design.md)

## 1. 목표

이메일/비밀번호 기반 로그인, accessToken/refreshToken 발급·재발급·폐기 API를 구현한다. 백엔드만 다루며 프론트엔드 연동은 범위 밖이다.

### Non-Goals

- 회원가입(자체 계정 생성) API — `PRODUCT.md`에 따라 계정은 관리자 도구에서 사전 생성되며 이 제품 범위 밖이다.
- accessToken 즉시 무효화(블랙리스트) — 로그아웃은 해당 기기의 refreshToken 세션만 폐기하고, 이미 발급된 accessToken은 만료(15분)까지 유효한 것을 허용한다. TTL이 짧아 리스크가 크지 않다.
- 로그인 엔드포인트 전용 별도 rate limit — 기존 전역 rate limiter(15분당 100회)로 충분하다고 보고 별도 작업으로 미룬다.
- 전체 기기 로그아웃("모든 세션 로그아웃") API — 이번 단계는 현재 기기 세션만 로그아웃한다. 필요해지면 후속 작업에서 `refresh:{userId}:*` 스캔 삭제로 추가한다.
- 정상 클라이언트의 refresh 재시도를 위한 멱등성 키/grace window — refresh token reuse detection(§2)은 이미 회전되어 폐기된 refreshToken이 다시 제시되면 세션 전체를 폐기한다. 이건 탈취된 토큰의 재사용을 막기 위한 의도적 설계이지만, 부작용으로 클라이언트가 네트워크 재시도 등으로 같은(이미 소비된) refreshToken을 다시 보내면 정상 세션도 강제 종료된다. 이를 서버에서 완전히 흡수하려면 클라이언트 멱등성 키 + grace window 같은 별도 프로토콜이 필요한데, 프론트엔드가 아직 없는 이번 단계에서는 과한 설계라 범위 밖으로 둔다. 대신 프론트엔드 구현 시 지켜야 할 계약으로 남긴다: **`/auth/refresh` 실패(401)를 자동 재시도하지 말고 재로그인 화면으로 유도할 것.**
- 프론트엔드 연동, Auth Shell UI 구현.

## 2. 토큰 정책

| 항목 | 값 |
|---|---|
| accessToken 유효기간 | 15분 |
| refreshToken 유효기간 | 2주 |
| refreshToken 저장소 | Valkey |
| 세션 정책 | **멀티 세션** — 기기(브라우저)별로 별도 세션 유지, 동시 로그인 허용 |
| refresh 시 회전 | 같은 세션 내에서 accessToken + refreshToken 모두 재발급. Valkey 값 교체는 Lua `EVAL` 기반 compare-and-set으로 원자적으로 수행하고, 제시된 토큰이 이미 회전되어 폐기된 것이면(reuse) 해당 세션을 통째로 삭제한다 |
| accessToken 전달 방식 | 로그인/refresh 성공 시 응답 body에 `accessToken` 포함 (프론트가 메모리에 보관, API 호출 시 `Authorization: Bearer` 헤더로 전송) |
| refresh 복원 사용자 정보 | refresh 성공 시 로그인과 동일한 `{ id, name, email }` 사용자 정보를 응답 body에 포함해 앱 부팅 시 메모리 세션을 복원 |
| refreshToken 전달 방식 | **httpOnly Secure 쿠키**로 전달 (응답 body에는 포함하지 않음) — JS에서 접근 불가능하게 해 XSS로 인한 탈취 위험을 줄인다 |

> 최초 요구사항(로그인 시 두 토큰 모두 response body로 응답)에서, "단일 세션 → 멀티 세션"과 "refreshToken을 body 대신 httpOnly 쿠키로" 두 가지를 사용자 요청에 따라 변경했다. accessToken은 여전히 body로 응답한다.

### 세션 식별자(sid)

멀티 세션을 지원하기 위해 로그인 시마다 세션 식별자 `sid`(`crypto.randomUUID()`)를 발급한다. accessToken과 refreshToken 모두 payload에 `sid`를 포함하며, refresh로 토큰이 회전되어도 같은 세션이 유지되는 한 `sid`는 바뀌지 않는다. 즉 `sid`는 "이 브라우저/기기의 로그인 세션"을 가리키고, 로그아웃은 이 `sid` 하나만 폐기한다(다른 기기의 세션에는 영향 없음).

accessToken과 refreshToken은 둘 다 jose(JWT)로 서명하되, payload에 `type: "access" | "refresh"` claim을 넣고 서로 다른 secret(`JWT_SECRET` / `JWT_REFRESH_SECRET`)으로 서명한다. 이렇게 하면 한 토큰을 다른 용도로 오용(예: refreshToken을 Authorization 헤더에 넣어 accessToken처럼 사용)할 수 없다. 또한 두 토큰 모두 `jti`(랜덤 UUID)를 포함한다 — HS256은 결정적 서명이라, 같은 `sub`/`sid`로 같은 초(`iat`)에 두 번 서명하면 완전히 동일한 토큰 문자열이 나올 수 있기 때문이다(로그인 직후 바로 refresh하는 흐름에서 실제로 재현 가능).

refreshToken 자체는 서버가 서명한 JWT이지만, 그것만으로 유효성을 인정하지 않는다. Valkey에 저장된 값과 대조해야만 유효한 것으로 취급한다(로그아웃/재로그인 시 즉시 폐기 가능해야 하므로). Valkey에는 refreshToken 원문이 아니라 `sha256` 해시를 저장한다.

- Valkey 키: `refresh:{userId}:{sid}`
- Valkey 값: refreshToken의 sha256 해시
- TTL: 2주 (refreshToken 만료와 동일, 회전 시마다 갱신)

같은 사용자가 여러 기기에서 로그인하면 `refresh:{userId}:{sid1}`, `refresh:{userId}:{sid2}` ... 형태로 기기별 키가 독립적으로 존재한다.

**회전의 원자성과 reuse detection.** 단순히 "Valkey GET으로 검증 후 SET으로 교체"하면, 두 refresh 요청이 동시에 들어오거나 refresh와 logout이 경합할 때 마지막에 쓰기가 끝난 요청이 이기면서 방금 발급한 토큰이 곧바로 무효화되거나, logout 직후에 refresh가 세션을 되살리는 문제가 생긴다. 이를 막기 위해 회전은 Lua `EVAL` 스크립트로 "저장된 해시가 예상한 이전 해시와 같을 때만 새 해시로 교체"하는 compare-and-set을 원자적으로 수행한다. 이 원자적 교체가 실패하면(=제시된 refreshToken이 이미 다른 요청에 의해 회전되었거나 애초에 세션이 없음) 그 즉시 `401`만 응답하는 게 아니라 해당 `sid`의 세션을 완전히 삭제한다 — 이미 폐기된(rotate된) 토큰이 나중에 다시 제시되는 것은 정상 흐름에서는 일어나지 않아야 하므로, 이를 탈취/재사용 신호로 간주해 세션 전체를 강제 종료하는 것이다(refresh token reuse detection). 이 설계의 트레이드오프는 §1 Non-Goals에 정리했다.

## 3. 쿠키 / CORS

refreshToken을 httpOnly 쿠키로 내려주려면 다음이 필요하다:

- 새 의존성: `cookie-parser` (+ `@types/cookie-parser`) — 요청의 쿠키 파싱.
- 쿠키 속성: `httpOnly: true`, `secure: NODE_ENV === "production"` (로컬 개발 시 http에서도 동작하도록), `sameSite: "lax"`, `path: "/auth/refresh"` (refresh 엔드포인트에만 전송되도록 범위 축소), `maxAge`: 2주.
- **주의**: 프론트엔드와 백엔드가 실제 배포 환경에서 서로 다른 도메인(cross-site)으로 나뉘면 `sameSite: "lax"`로는 쿠키가 전송되지 않을 수 있다. 그 경우 `sameSite: "none"` + `secure: true`(HTTPS 필수)로 바꿔야 한다 — 배포 구조가 확정되면 재확인이 필요한 부분이다.
- CORS: 쿠키를 주고받으려면 `cors()`를 와일드카드가 아닌 `{ origin: <프론트 origin>, credentials: true }`로 명시해야 한다. 새 환경변수 `CORS_ORIGIN`을 추가하고(zod 검증, 기본값 `http://localhost:5173` — 프론트 vite 기본 포트), `app.ts`의 `cors()` 설정에 사용한다.
- `.env.example`에 `CORS_ORIGIN` 예시 추가.
- **CSRF 방어(Origin 검사)**: 기본값 `sameSite: "lax"`에서는 cross-site `POST`에 쿠키가 실리지 않으므로 현재 배포 기준 CSRF 위험은 낮다. 하지만 단순 `POST` 요청은 브라우저가 CORS preflight 없이 그대로 전송하고 `Set-Cookie` 응답도 그대로 적용되므로(공격자가 응답 본문을 못 읽는 것과는 별개), 향후 cross-site 배포 때문에 `sameSite: "none"`으로 바꾸면 공격 사이트가 피해자의 refresh 쿠키를 강제로 회전시킬 수 있다. 이를 대비해 `/auth/refresh`에서 `Origin` 헤더가 존재하는데 `CORS_ORIGIN`과 다르면 `403 INVALID_ORIGIN`으로 거부한다(Origin이 없는 서버 간 호출 등은 통과 — 애초에 쿠키가 없어 위험하지 않다). `/auth/logout`은 쿠키가 아니라 `Authorization` 헤더 기반이라 애초에 CSRF에 안전하다.

## 4. 엔드포인트

### `POST /auth/login`

요청: `{ email: string, password: string }` (zod 검증)

처리 순서:
1. 이메일을 lowercase로 정규화한 뒤, `users` 테이블 조회 자체를 대소문자 무시로 수행한다 — `eq(users.email, normalizedEmail)`(정확히 일치)가 아니라 `sql\`lower(${users.email}) = ${normalizedEmail}\``(양쪽 다 소문자로 맞춰서 비교)를 사용한다(`backend/src/services/user.service.ts`). 이렇게 하면 `users.email` 컬럼에 실제로 어떤 대소문자로 저장되어 있는지(관리자 도구가 소문자로 저장한다는 보장 여부)와 무관하게 항상 매칭된다 — "한 번 정규화해서 저장에 의존"하는 대신 "비교 시점마다 매번 정규화"하므로, 계정 생성 시점의 케이스와 로그인 시점 입력의 케이스가 다르더라도 불일치가 발생할 수 없다.
2. 계정이 없으면, 더미 bcrypt 해시에 대해 `password`를 compare한 뒤(타이밍 공격으로 계정 존재 여부가 유추되지 않도록) `401 INVALID_CREDENTIALS` 응답.
3. 계정이 있으면 저장된 `passwordHash`와 `password`를 bcrypt로 compare. 불일치 시 동일하게 `401 INVALID_CREDENTIALS` (계정 없음/비밀번호 틀림을 구분하지 않는 동일 메시지 — 계정 존재 여부 유추 방지).
4. 성공 시 `sid` 발급, accessToken(15분)/refreshToken(2주)을 각각 서명. Valkey `refresh:{userId}:{sid}`에 refreshToken 해시 저장(TTL 2주). 기존에 다른 `sid`로 로그인된 세션(다른 기기)은 그대로 유지.
5. refreshToken을 httpOnly 쿠키로 `Set-Cookie` (§3 속성).
6. 응답(200) body: `{ accessToken, user: { id, name, email } }`.

### `POST /auth/refresh`

요청: 쿠키의 `refreshToken` 사용 (요청 body 없음)

처리 순서:
1. `Origin` 헤더가 있는데 `CORS_ORIGIN`과 다르면 `403 INVALID_ORIGIN`(§3).
2. 쿠키에 refreshToken이 없으면 `401 INVALID_REFRESH_TOKEN`.
3. jose로 refreshToken 서명/만료/`type === "refresh"` 검증. 실패 시 `401 INVALID_REFRESH_TOKEN`.
4. payload의 `sub`(userId)로 유저 조회. 존재하지 않으면 `401 INVALID_REFRESH_TOKEN`.
5. 같은 `sid`로 accessToken/refreshToken을 새로 서명한 뒤, Valkey `refresh:{userId}:{sid}`에 대해 "저장된 해시가 제시된 refreshToken의 해시와 같을 때만 새 해시로 교체"하는 원자적 compare-and-set을 시도한다.
6. 5번이 실패하면(이미 회전되어 폐기된 토큰이거나 세션 없음) 해당 `sid` 세션을 완전히 삭제하고(reuse detection) `401 INVALID_REFRESH_TOKEN`.
7. 성공하면 새 refreshToken을 httpOnly 쿠키로 `Set-Cookie`.
8. 응답(200) body: `{ accessToken, user: { id, name, email } }`.

### `POST /auth/logout`

- `authenticate` 미들웨어(기존 `middlewares/auth.middleware.ts`)로 accessToken 검증, `req.user.sub`/`req.user.sid`로 사용자·세션 식별.
- Valkey `refresh:{userId}:{sid}` 키 삭제 (현재 기기 세션만 — 다른 기기 세션은 영향 없음).
- refreshToken 쿠키를 `Max-Age=0`으로 재설정해 클라이언트에서도 제거.
- 응답(204).
- accessToken 자체는 폐기하지 않으므로 만료(15분) 전까지는 재사용 가능하다(§1 Non-Goals에 명시한 트레이드오프).

## 5. 파일 구성

모든 경로는 저장소 루트 기준이며, 소스 파일은 전부 `backend/` 아래에 있다.

```
backend/src/config/env.ts               (수정) JWT_REFRESH_SECRET, CORS_ORIGIN 추가
backend/.env.example                     (수정) JWT_REFRESH_SECRET, CORS_ORIGIN 예시 값 추가
backend/package.json                     (수정) bcrypt, cookie-parser, @types/bcrypt, @types/cookie-parser 추가
backend/src/lib/jwt.ts                   (수정) signRefreshToken/verifyRefreshToken 추가, access/refresh 토큰 payload에 sid + type + jti claim 포함, accessToken 만료 15분으로 변경
backend/src/lib/password.ts              (신규) hashPassword/comparePassword(bcrypt), 더미 해시 상수
backend/src/services/user.service.ts     (신규) getUserByEmail(email)/getUserById(id) — lowercase 정규화 후 조회
backend/src/services/session.service.ts  (신규) saveRefreshSession/rotateRefreshSession(Lua EVAL 기반 원자적 compare-and-set)/deleteRefreshSession (Valkey, key: refresh:{userId}:{sid})
backend/src/services/auth.service.ts     (신규) login/refresh/logout 비즈니스 로직 조합, sid 발급, 회전 실패 시 reuse detection으로 세션 삭제
backend/src/controllers/auth.controller.ts (신규) 요청 파싱, Origin 검사, 쿠키 설정/해제 → service 호출 → 응답
backend/src/routes/auth.routes.ts        (신규)
backend/src/routes/index.ts              (수정) authRouter를 `/auth`에 마운트
backend/src/schemas/auth.schema.ts       (신규) loginSchema (zod, refresh/logout은 body 없음)
backend/src/utils/http-error.ts          (신규) HttpError(status, code, message)
backend/src/middlewares/error-handler.middleware.ts (수정) err가 HttpError면 그 status/code 사용, 아니면 기존처럼 500
backend/src/app.ts                       (수정) cookie-parser 등록, cors()를 { origin: CORS_ORIGIN, credentials: true }로 변경, pino-http에 Authorization/Cookie 헤더 redact 옵션 추가
backend/src/types/express.d.ts           (수정 불필요, AccessTokenPayload에 sid 필드가 추가되면 자동 반영)
```

계층 책임은 기존 스캐폴딩 설계(routes → controllers → services → db/schema)를 그대로 따른다.

## 6. 에러 처리

기존 `error-handler.middleware.ts`는 모든 에러를 500으로 처리하는데, 로그인 기능은 401/400 등 다양한 상태 코드가 필요하다. 이를 위해 `HttpError`(status, code, message를 가진 Error 서브클래스)를 도입하고, 에러 핸들러가 `err instanceof HttpError`면 해당 status/code를, 아니면 기존처럼 500/`INTERNAL_SERVER_ERROR`를 반환하도록 한다(기존 동작과 하위 호환).

| 상황 | status | code |
|---|---|---|
| 이메일/비밀번호 불일치 또는 존재하지 않는 계정 | 401 | INVALID_CREDENTIALS |
| refreshToken 쿠키 없음/무효/만료/Valkey 불일치 | 401 | INVALID_REFRESH_TOKEN |
| 요청 바디 검증 실패 | 400 | VALIDATION_ERROR |

## 7. 로깅

`app.ts`의 `pinoHttp({ logger })` 설정에 `redact` 옵션을 추가해 `req.headers.authorization`, `req.headers.cookie`, 그리고 **응답 헤더의 `Set-Cookie`(`res.headers["set-cookie"]`)**가 로그에 평문으로 남지 않도록 한다. pino-http의 기본 응답 serializer는 응답 헤더 전체를 기록하므로, 요청 헤더만 redact하면 로그인/refresh 성공 시 `Set-Cookie`에 담긴 refreshToken 원문이 그대로 로그에 남는다 — httpOnly 쿠키로 XSS를 막아도 로그 자체가 새는 경로가 되므로 응답 헤더 redact가 필수다.

에러 로깅 레벨도 구분한다: `HttpError`(401/400 등 클라이언트 오류)는 `warn` 레벨로 `{ status, code }`만 남기고 `err` 객체/스택은 남기지 않는다. 로그인 실패, 만료된 토큰처럼 정상적으로 발생하는 이벤트를 매번 `error` 레벨 + 스택으로 남기면 알림 피로(alert fatigue)를 유발하고, 공격자가 반복 로그인 실패만으로 에러 로그 볼륨을 부풀릴 수 있다. 진짜 예기치 못한 500 에러만 `error` 레벨 + 전체 `err` 객체로 남긴다.

## 8. 테스트 전략

기존 리포 컨벤션(`tests/*.test.ts`, vitest)에는 실제로 붙는 테스트 DB/Valkey 인프라(docker-compose, CI)가 없고 전부 순수 유닛/모킹 테스트다. 이 기능도 동일하게 `vi.mock`으로 `db`/`valkey`를 모킹해 외부 인프라 없이 테스트한다.

- `password.test.ts`: hash/compare 라운드트립, 틀린 비밀번호 거부, 더미 해시 compare 동작.
- `jwt.test.ts` 확장: refreshToken sign/verify 라운드트립, sid/type/jti claim 포함 확인, type claim 불일치 시 거부(access 토큰을 refresh로 검증 시도 등), 동일 payload를 연속으로 서명해도 jti 덕분에 토큰이 겹치지 않는지 확인.
- `user-service.test.ts`: 이메일 lowercase 정규화 후 조회, id로 조회.
- `session-service.test.ts`: Valkey mock으로 세션별(sid) 저장, 원자적 회전(`rotateRefreshSession`) 성공/실패(이미 회전된 토큰·존재하지 않는 세션), 서로 다른 sid의 세션이 독립적인지, 저장값이 실제 sha256 해시와 정확히 일치하는지, 삭제 확인.
- `auth-service.test.ts`: login/refresh/logout 비즈니스 로직을 하위 의존성(password/jwt/user.service/session.service)을 모킹해 단위 테스트. refresh 회전 실패 시 `deleteRefreshSession`이 호출되는지(reuse detection) 확인.
- `auth.test.ts` (supertest, db/valkey는 `vi.mock`): 로그인 성공/실패(계정 없음, 비밀번호 틀림), 로그인 응답에 accessToken은 body로 오고 refreshToken은 body에 없이 `Set-Cookie`로만 오는지 확인(HttpOnly/SameSite/Path/Max-Age 속성 포함), 멀티 세션 독립성(두 기기 동시 로그인), refresh 성공 응답에 accessToken/user가 포함되는지 확인, refresh 성공/실패/회전 후 이전 refreshToken 무효화 확인, 회전된 refreshToken을 재사용하면 새로 회전된 토큰까지 함께 세션 폐기되는지(reuse detection) 확인, Origin 헤더가 CORS_ORIGIN과 다르면 403 확인, logout 후 해당 세션으로 refresh 불가 + 다른 기기(sid) 세션은 영향 없음 확인.

## 9. 완료 기준 (Definition of Done)

- `POST /auth/login`에 올바른 자격증명으로 요청 시 200과 함께 body로 `accessToken`/`user`가 응답되고, `Set-Cookie`로 httpOnly refreshToken 쿠키가 내려오며, Valkey에 `refresh:{userId}:{sid}` 세션이 저장된다.
- 같은 계정으로 서로 다른 두 클라이언트(쿠키 컨텍스트)에서 로그인하면 두 세션이 동시에 유효하다(멀티 세션 확인).
- 잘못된 이메일/비밀번호로 요청 시 401 `INVALID_CREDENTIALS`가 응답되고, 계정 존재 여부와 무관하게 응답 시간이 유사하다.
- `POST /auth/refresh`에 유효한 refreshToken 쿠키로 요청 시 새 accessToken/user(body)와 새 refreshToken(쿠키)이 발급되고, 이전 refreshToken으로는 더 이상 refresh할 수 없다. 이 회전은 Lua 기반 원자적 compare-and-set으로 이뤄진다.
- 이미 회전되어 폐기된 refreshToken을 다시 제시하면(reuse) 그 sid의 세션 전체가 삭제되어, 방금 정상적으로 발급된 새 refreshToken까지 함께 무효화된다.
- `Origin` 헤더가 `CORS_ORIGIN`과 다른 refresh 요청은 `403 INVALID_ORIGIN`으로 거부된다.
- `POST /auth/logout` 후에는 해당 세션(sid)의 refreshToken으로 refresh가 실패하며, 다른 기기(sid)의 세션은 영향받지 않는다.
- `pnpm lint`, `pnpm test`가 통과한다.
- 실제 PostgreSQL/Valkey 인스턴스 없이도(모킹으로) 위 항목이 테스트로 검증 가능하다.
