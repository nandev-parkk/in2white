# 계정 설정 백엔드 설계

## 상태

사용자 설계 승인 완료 · 자체 검토 완료

## 목표

인증된 사용자가 자신의 계정 정보를 조회하고 이름과 비밀번호를 변경할 수 있는 백엔드 API를 추가한다. 비밀번호 변경 시 현재 기기는 새 세션으로 자동 전환하여 로그인을 유지하고, 다른 기기의 refresh 세션은 모두 무효화한다. 기존 access token은 상태 조회 비용을 추가하지 않고 최대 15분의 기존 만료 시간까지 허용한다.

## 근거 문서

- `PRODUCT.md`
  - 로그인한 사용자는 자신의 이름과 비밀번호를 변경할 수 있다.
  - 이메일은 변경할 수 없으며 조회용이다.
  - 비밀번호 변경 시 현재 비밀번호를 확인해야 한다.
  - 계정 설정 화면은 사용자의 참여 워크스페이스 목록도 보여준다.
- `DESIGN.md`
  - 기본 정보와 비밀번호 변경을 별도 섹션으로 제공한다.
  - 비밀번호 변경 UI는 현재 비밀번호, 새 비밀번호, 새 비밀번호 확인 입력을 사용한다.
  - 현재 비밀번호 확인 실패는 해당 입력 가까이에 표시한다.
- `backend/README.md`
  - `routes → controllers → services → db/schema` 계층을 따른다.
- 기존 인증 구현
  - access token은 15분, refresh token은 2주 동안 유효하다.
  - refresh token은 `refresh:{userId}:{sid}` 키에 SHA-256 해시로 저장한다.
  - refresh token은 매 refresh 시 회전하며, 멀티 세션을 지원한다.
  - refresh 과정은 이미 DB에서 사용자를 조회한다.

## 범위

### 포함

- `GET /account` 계정 정보 조회
- `PATCH /account` 이름 변경
- `PATCH /account/password` 현재 비밀번호 확인 기반 비밀번호 변경
- `users.session_version` 컬럼과 Drizzle migration
- refresh token의 `ver` claim 발급·검증
- 비밀번호 변경 시 `passwordHash` 변경과 `sessionVersion` 증가
- 비밀번호 변경을 요청한 현재 기기에 새 `sid`, access token, refresh token 발급
- 변경 전 현재 세션과 다른 기기의 refresh token 무효화
- 오래된 Valkey refresh 세션 키의 best-effort 정리
- 인증·입력·오류·세션 전환·민감 정보 비노출 테스트

### 제외

- 이메일 변경
- 회원가입, 비밀번호 찾기·재설정
- 계정 탈퇴
- 프로필 이미지와 알림 설정
- 프론트엔드 계정 설정 화면
- 세션 목록 조회와 개별 기기 로그아웃 UI/API
- 비밀번호 변경 시 세션 유지 여부를 사용자가 선택하는 옵션
- access token의 즉시 서버 측 폐기
- 감사 로그 테이블 또는 알림 이메일

계정 설정 화면의 참여 워크스페이스 목록은 기존 `GET /workspaces` 응답을 재사용한다. 계정 API에서 같은 데이터를 중복 반환하지 않는다.

## 핵심 결정

### 현재 세션은 유지하되 완전히 교체한다

현재 비밀번호 검증은 민감 작업에 대한 재인증으로 취급한다. 검증에 성공하면 기존 현재 세션을 그대로 연장하지 않고 새 `sid`와 token 쌍을 발급한다. 프론트엔드는 응답의 새 access token으로 기존 값을 교체하므로 사용자는 다시 로그인하지 않는다.

### 다른 refresh 세션은 모두 무효화한다

서버는 다른 기기의 정상 세션과 탈취된 세션을 확실히 구분할 수 없다. 비밀번호 변경은 자주 일어나는 작업이 아니므로 현재 기기의 흐름은 유지하면서 다른 기기는 다음 refresh 시 재로그인하도록 한다.

### `sessionVersion`을 refresh 무효화의 보안 경계로 사용한다

Valkey의 `refresh:{userId}:*` 키를 `SCAN`으로 삭제하는 방식은 순회 중 생성되는 세션을 놓칠 수 있다. 대신 사용자의 세션 세대를 나타내는 `sessionVersion`을 DB에 저장하고 refresh token에 같은 값을 `ver` claim으로 넣는다.

refresh 시 token의 `ver`와 DB의 `sessionVersion`이 다르면 Valkey에 일치하는 token 해시가 남아 있어도 거부한다. Valkey 키 삭제는 보안 보장이 아닌 저장 공간 정리 작업이다.

### access token은 최대 15분 자연 만료한다

일반 API 요청마다 DB나 Valkey 상태를 조회하지 않는다. 비밀번호 변경 전 발급된 access token은 기존 만료 시간까지 최대 15분 동안 유효할 수 있다. 프론트엔드는 비밀번호 변경 성공 응답을 받은 현재 기기의 access token을 즉시 새 token으로 교체한다.

## 데이터 모델

`users` 테이블에 다음 컬럼을 추가한다.

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `session_version` | `integer` | `NOT NULL DEFAULT 0` | 현재 유효한 refresh 세션 세대 |

Drizzle 모델은 `sessionVersion: integer("session_version").default(0).notNull()`로 정의한다. 기존 사용자는 migration 시 버전 `0`을 가진다.

기존 배포 token과의 호환을 위해 refresh token의 `ver` claim이 없으면 버전 `0`으로 해석한다. migration 직후 기존 사용자의 DB 버전도 `0`이므로 기존 세션은 유지된다. 해당 사용자가 비밀번호를 변경하면 DB 버전이 `1` 이상으로 증가하여 기존 token이 무효화된다.

## API 계약

모든 계정 API는 `authenticate` middleware를 사용한다. 에러 응답은 기존 `{ error: { message, code } }` 형식을 유지한다.

### 계정 정보 조회

```http
GET /account
Authorization: Bearer <access-token>
```

성공 시 HTTP `200 OK`를 반환한다.

```json
{
  "user": {
    "id": "user-id",
    "name": "사용자 이름",
    "email": "user@example.com"
  }
}
```

`passwordHash`와 `sessionVersion`은 응답에 포함하지 않는다.

### 이름 변경

```http
PATCH /account
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "name": "변경할 이름"
}
```

이름은 앞뒤 공백을 제거한 뒤 1~255자로 검증한다. 성공 시 HTTP `200 OK`와 갱신된 안전한 사용자 객체를 반환한다.

```json
{
  "user": {
    "id": "user-id",
    "name": "변경할 이름",
    "email": "user@example.com"
  }
}
```

같은 이름을 다시 제출해도 성공하는 멱등 동작으로 처리한다.

### 비밀번호 변경

```http
PATCH /account/password
Authorization: Bearer <current-access-token>
Content-Type: application/json

{
  "currentPassword": "현재 비밀번호",
  "newPassword": "새 비밀번호"
}
```

새 비밀번호 확인 값은 프론트엔드가 요청 전에 비교한다. 백엔드는 중복된 확인 값을 받지 않고 `newPassword` 자체의 정책을 검증한다.

성공 시 HTTP `200 OK`를 반환하며 새 refresh token은 기존과 동일하게 body가 아닌 HttpOnly 쿠키로만 전달한다.

```http
Set-Cookie: refreshToken=<new-refresh-token>; HttpOnly; Path=/auth/refresh; ...
```

```json
{
  "accessToken": "new-access-token",
  "user": {
    "id": "user-id",
    "name": "사용자 이름",
    "email": "user@example.com"
  }
}
```

프론트엔드는 기존 access token을 새 값으로 교체하고 계정 설정 화면을 유지한다.

## 검증 규칙

### 이름

- 문자열이어야 한다.
- 앞뒤 공백을 제거한다.
- 공백 제거 후 1자 이상 255자 이하여야 한다.

### 현재 비밀번호

- 비어 있지 않은 문자열이어야 한다.
- 형식 정책으로 진위를 판단하지 않고 저장된 bcrypt 해시와 전체 값을 비교한다.
- 불일치 시 `400 CURRENT_PASSWORD_MISMATCH`를 반환한다. 유효한 Bearer 인증이 실패한 것이 아니므로 `401`을 사용하지 않아 프론트엔드의 자동 token refresh를 유발하지 않는다.

### 새 비밀번호

기존 `passwordSchema`를 재사용한다.

- 8~32자
- 영문 포함
- 숫자 포함
- 특수문자 포함

현재 비밀번호와 새 비밀번호가 같아도 별도 오류로 거부하지 않는다. 제품 문서에 없는 정책을 추가하지 않고, 같은 비밀번호 제출도 정상적인 비밀번호 변경과 세션 교체로 처리한다.

## 오류 계약

| 상황 | 상태 | 코드 | 처리 |
|---|---:|---|---|
| 인증 헤더가 없거나 access token이 유효하지 않음 | 401 | `UNAUTHORIZED` | 인증 middleware에서 차단 |
| 요청 body 검증 실패 | 400 | `VALIDATION_ERROR` | controller에서 차단 |
| 현재 비밀번호 불일치 | 400 | `CURRENT_PASSWORD_MISMATCH` | 비밀번호·세션을 변경하지 않음 |
| 유효한 token의 사용자를 DB에서 찾을 수 없음 | 404 | `ACCOUNT_NOT_FOUND` | 계정 정보를 반환하지 않음 |
| 비밀번호 저장 후 새 현재 세션 발급·저장 실패 | 503 | `PASSWORD_CHANGED_REAUTH_REQUIRED` | refresh 쿠키를 제거하고 새 비밀번호 재로그인을 요구 |
| 예상하지 못한 DB·bcrypt 오류 | 500 | `INTERNAL_SERVER_ERROR` | 기존 오류 처리 계층 사용 |

현재 비밀번호 불일치 메시지는 계정 존재 여부가 아닌 이미 인증된 자기 계정의 입력 오류만 나타낸다.

## 아키텍처와 파일 경계

### Route

`backend/src/routes/account.routes.ts`를 추가하고 루트 router에 `/account`로 연결한다.

- `GET /` → 계정 정보 조회
- `PATCH /` → 이름 변경
- `PATCH /password` → 비밀번호 변경과 현재 세션 전환

모든 라우트는 `authenticate`와 `asyncHandler`를 사용한다.

### Controller

`backend/src/controllers/account.controller.ts`는 다음만 담당한다.

- `requireUser(req)`로 인증된 사용자의 `sub`를 가져온다. 비밀번호 변경 시 현재 sid를 재사용하지 않고 서비스에서 새 sid를 발급한다.
- 요청 body를 Zod schema로 검증한다.
- account service를 호출한다.
- 안전한 사용자 객체와 상태 코드를 반환한다.
- 비밀번호 변경 성공 시 새 refresh token 쿠키를 설정한다.
- `PASSWORD_CHANGED_REAUTH_REQUIRED` 오류일 때만 refresh 쿠키를 제거한다. 현재 비밀번호 불일치나 DB 갱신 전 오류는 기존 세션에 영향을 주지 않는다.

기존 `auth.controller.ts` 안의 refresh 쿠키 설정·삭제 함수는 `backend/src/utils/auth-cookie.ts`로 옮겨 로그인, refresh, logout, 계정 비밀번호 변경이 동일한 옵션을 사용하게 한다.

### Schema

`backend/src/schemas/account.schema.ts`에 다음 schema를 둔다.

- `updateAccountSchema`: `{ name }`
- `changePasswordSchema`: `{ currentPassword, newPassword }`

이름 전용 schema는 계정 도메인에 두고 새 비밀번호는 기존 `passwordSchema`를 재사용한다.

### Account Service

`backend/src/services/account.service.ts`는 다음 유스케이스를 제공한다.

- `getAccount(userId)`
- `updateAccount({ userId, name })`
- `changeAccountPassword({ userId, currentPassword, newPassword })`

서비스 밖으로 `passwordHash`와 `sessionVersion`을 반환하지 않는다. 비밀번호 변경 결과는 새 access token, 새 refresh token, 안전한 사용자 객체만 노출한다.

### User Service

`backend/src/services/user.service.ts`에 사용자 갱신용 DB 함수를 추가한다.

- 이름 갱신 후 안전한 사용자 필드를 반환한다.
- 비밀번호 해시 갱신과 `sessionVersion + 1`을 단일 원자적 update로 처리하고 새 버전을 반환한다.
- update 결과가 없으면 `ACCOUNT_NOT_FOUND`로 변환할 수 있게 명시적인 결과를 제공한다.

### JWT

refresh token payload에 `ver`를 추가한다. access token에도 같은 `ver`를 포함해 새 세션의 세대를 명시하지만, 일반 인증 middleware에서는 DB와 비교하지 않는다.

- 로그인: DB 사용자의 현재 `sessionVersion`으로 access/refresh token 발급
- refresh: token의 `ver`와 DB 사용자의 `sessionVersion` 비교
- 비밀번호 변경: 증가된 버전으로 새 `sid`와 access/refresh token 발급

refresh token의 버전이 현재 DB와 다르면 `401 INVALID_REFRESH_TOKEN`으로 거부하고 제시된 `sid`의 Valkey 키를 삭제한다.

### Session Service

현재 세션 전환 시 증가된 버전으로 서명한 새 refresh token을 새 `sid` 키에 저장한다. 기존 sid와 다른 기기의 키는 best-effort로 정리한다.

정리는 non-blocking `SCAN MATCH refresh:{userId}:* COUNT <batch-size>`와 batch `DEL`을 사용한다. 새 sid 키는 삭제 대상에서 제외한다. 정리 중 생성되거나 누락된 키가 있어도 `sessionVersion` 불일치 때문에 사용할 수 없다.

## 비밀번호 변경 데이터 흐름

```text
authenticate access token
  └─ 실패 → 401 UNAUTHORIZED
validate currentPassword/newPassword
  └─ 실패 → 400 VALIDATION_ERROR
load user by access token sub
  └─ 없음 → 404 ACCOUNT_NOT_FOUND
compare currentPassword with passwordHash
  └─ 불일치 → 400 CURRENT_PASSWORD_MISMATCH
hash newPassword
atomically update passwordHash and increment sessionVersion
generate new sid and tokens with incremented version
save new refresh session in Valkey
  └─ 실패 → refresh 쿠키 제거 + 503 PASSWORD_CHANGED_REAUTH_REQUIRED,
             이전 refresh 세션은 버전 불일치로 무효
best-effort cleanup old Valkey refresh keys
  └─ 실패 → warn 로그, 성공 응답 유지
set new refresh cookie
return 200 with new accessToken and safe user
```

DB 비밀번호 갱신과 Valkey 세션 저장은 서로 다른 저장소라 하나의 transaction으로 묶을 수 없다. DB 갱신 후 token 발급 또는 새 세션 저장이 실패하면 서비스가 원인을 민감 정보 없이 error 로그로 남기고 `503 PASSWORD_CHANGED_REAUTH_REQUIRED`를 반환한다. 기존 refresh token은 증가한 `sessionVersion`과 맞지 않아 모두 무효이며, controller는 refresh 쿠키를 제거한다. 현재 사용자는 새 비밀번호로 다시 로그인해야 한다. 정상 경로에서는 자동 세션 전환으로 재로그인이 없다.

## 동시성 계약

- 비밀번호 변경 전에 시작된 로그인 요청이 변경 후 refresh 세션을 저장하더라도 token에는 이전 `sessionVersion`이 들어 있으므로 refresh가 거부된다.
- 변경 전에 시작된 refresh 요청이 늦게 완료되더라도 발급 token의 이전 버전은 다음 refresh에서 거부된다.
- 변경 전 access token은 상태 저장소를 확인하지 않으므로 최대 15분 동안 유효할 수 있다.
- 현재 기기는 변경 응답에서 새 access token으로 즉시 교체한다.
- 여러 비밀번호 변경 요청이 동시에 현재 비밀번호 검증을 통과할 수 있다. DB의 `sessionVersion + 1` update는 각 요청마다 원자적으로 증가하지만 마지막으로 저장된 비밀번호만 유효하다. 프론트엔드는 제출 중 버튼을 비활성화하며, 백엔드 테스트는 순차 계약을 기준으로 한다. 별도 분산 잠금은 범위에 포함하지 않는다.

## 보안 및 로깅

- 비밀번호 원문, bcrypt 해시, access/refresh token을 로그에 기록하지 않는다.
- 응답에는 `passwordHash`, `sessionVersion`을 포함하지 않는다.
- refresh token은 계속 HttpOnly 쿠키로만 전달한다.
- 현재 비밀번호 불일치는 예상 가능한 클라이언트 오류로 처리하고 민감 값을 로그에 남기지 않는다.
- Valkey 정리 실패는 userId·token 없이 구조화된 warn 로그를 남긴다.
- 예상하지 못한 내부 오류는 기존 error handler의 일반 메시지 계약을 따른다.
- 기존 전역 rate limit middleware를 그대로 적용한다. 계정별·엔드포인트별 별도 rate limit은 이번 범위에서 추가하지 않는다.

## 테스트 전략

기존 Vitest, Supertest, DB·Valkey mock 패턴을 사용한다.

### Schema 테스트

- 이름 trim, 빈 값, 255자 경계, 초과 길이
- 현재 비밀번호 누락
- 새 비밀번호의 기존 정책 성공·실패
- 알 수 없는 필드 처리의 기존 Zod 기본 동작 유지

### User/Account Service 테스트

- 계정 조회가 안전한 사용자 필드만 반환한다.
- 이름 변경이 trim된 값을 저장하고 안전한 사용자 객체를 반환한다.
- 현재 비밀번호 불일치 시 hash, DB update, token 발급, Valkey 변경이 발생하지 않는다.
- 성공 시 새 비밀번호를 hash하고 `sessionVersion`을 증가시킨다.
- 증가된 버전과 새 sid로 access/refresh token을 발급한다.
- 새 refresh 세션 저장 실패 시 내부 오류를 반환하고 이전 refresh token이 버전상 무효임을 검증한다.

### JWT/Auth 테스트

- refresh token에 `ver`가 포함된다.
- `ver` 없는 기존 refresh token은 `0`으로 해석된다.
- refresh token 버전과 DB 버전이 같으면 기존 회전 흐름이 동작한다.
- 버전이 다르면 `401 INVALID_REFRESH_TOKEN`이며 새 token을 발급하지 않는다.
- 로그인은 현재 DB `sessionVersion`으로 token을 발급한다.

### Session Service 테스트

- 새 sid refresh 세션을 저장한다.
- 사용자 refresh 키를 `SCAN`으로 여러 batch에 걸쳐 순회한다.
- 새 sid는 보존하고 이전 sid 키는 삭제한다.
- 대상 키가 없어도 성공한다.
- 정리 실패는 새 세션의 유효성을 취소하지 않으며 warn 로그 대상이 된다.

### API 테스트

- `GET /account` 성공과 `passwordHash`·`sessionVersion` 비노출
- `PATCH /account` 성공, trim, validation 실패
- `PATCH /account/password` 성공 시 `200`, 새 access token body, 새 HttpOnly refresh 쿠키
- 비밀번호 변경 응답 body에 refresh token이 없는지 확인
- 현재 비밀번호 불일치 시 `400 CURRENT_PASSWORD_MISMATCH`
- 인증 없는 모든 계정 요청은 `401`
- 존재하지 않는 인증 사용자는 `404 ACCOUNT_NOT_FOUND`
- DB와 Valkey 오류 계약
- 비밀번호 변경 성공 후 기존 refresh token은 거부되고 새 refresh token은 허용됨
- 다른 sid의 기존 refresh token도 버전 불일치로 거부됨

### 검증 명령

```bash
pnpm --dir backend test -- tests/account-schema.test.ts tests/account-service.test.ts tests/account.test.ts tests/auth-service.test.ts tests/jwt.test.ts tests/session-service.test.ts tests/user-service.test.ts
pnpm --dir backend test
pnpm --dir backend lint
pnpm --dir backend build
git diff --check
```

변경 파일에는 프로젝트 Prettier 설정을 적용하고, 전체 formatter baseline에 기존 무관한 문제가 있으면 별도로 기록한다.

## 완료 기준

- 인증된 사용자가 안전한 계정 정보를 조회할 수 있다.
- 이메일은 변경할 수 없고 이름만 독립적으로 변경할 수 있다.
- 현재 비밀번호가 맞을 때만 새 비밀번호가 저장된다.
- 비밀번호와 `sessionVersion`이 함께 원자적으로 갱신된다.
- 현재 기기는 새 sid와 token으로 자동 전환되어 재로그인하지 않는다.
- 다른 기기의 refresh token은 다음 refresh부터 거부된다.
- 기존 access token의 최대 15분 잔여 유효시간이 명시적으로 유지된다.
- refresh token, 비밀번호 원문·해시, sessionVersion이 응답이나 로그에 노출되지 않는다.
- 관련 테스트, 전체 테스트, lint, build, diff 검사가 통과한다.
- 구현 결과와 계획 차이는 구현 계획 문서의 `Implementation Results`에 기록한다.

## 최종 결정 사항

- 계정 API prefix는 `/account`다.
- 조회, 이름 변경, 비밀번호 변경을 별도 endpoint로 분리한다.
- 참여 워크스페이스는 기존 `/workspaces` API를 재사용한다.
- 현재 비밀번호 불일치는 `400 CURRENT_PASSWORD_MISMATCH`다.
- 비밀번호 변경 성공 응답은 `200`이며 새 access token과 안전한 사용자 객체를 body로 반환한다.
- 새 refresh token은 HttpOnly 쿠키로만 전달한다.
- 현재 세션은 새 sid와 token으로 자동 전환한다.
- 다른 refresh 세션은 `sessionVersion`으로 무효화한다.
- access token은 최대 15분 자연 만료한다.
- Valkey 세션 키 정리는 best-effort이며 보안 경계가 아니다.
- 이메일 변경, 세션 선택 옵션, access token 즉시 폐기는 범위에서 제외한다.
- 실제 migration 적용과 Git commit은 사용자 요청 전까지 실행하지 않는다.
