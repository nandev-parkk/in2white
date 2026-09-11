# 계정 설정 백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증된 사용자가 계정 정보를 조회하고 이름과 비밀번호를 변경하며, 비밀번호 변경 시 현재 기기는 새 세션으로 자동 전환하고 다른 refresh 세션은 무효화하는 백엔드 API를 구현한다.

**Architecture:** 기존 `routes → controllers → services → db/schema` 계층을 유지하고 `/account` 전용 경계를 추가한다. `users.sessionVersion`과 JWT `ver` claim으로 refresh 세션 세대를 검증하며, 비밀번호 변경 요청에는 증가한 버전으로 새 sid/token을 발급한다. Valkey의 오래된 세션 키는 best-effort로 정리하고 access token은 기존 15분 만료 정책을 유지한다.

**Tech Stack:** Node.js 20+, TypeScript ESM, Express 4, Drizzle ORM/PostgreSQL, jose, bcrypt, iovalkey, Zod 4, Vitest, Supertest, pnpm.

**Spec:** [`docs/superpowers/specs/2026-09-10-account-settings-backend-design.md`](../specs/2026-09-10-account-settings-backend-design.md)

## Global Constraints

- 모든 사용자 대면 메시지와 문서는 한국어로 작성한다.
- 모든 계정 endpoint는 `authenticate`와 `asyncHandler`를 사용한다.
- 에러 응답은 `{ error: { message, code } }` 형식을 유지한다.
- access token 유효기간은 15분, refresh token 유효기간은 2주다.
- refresh token은 body에 포함하지 않고 HttpOnly, `Path=/auth/refresh`, `SameSite=Lax` 쿠키로만 전달한다.
- 비밀번호 원문·해시, access/refresh token, `sessionVersion`을 응답이나 로그에 기록하지 않는다.
- 기존 refresh token에 `ver` claim이 없으면 버전 `0`으로 해석한다.
- 참여 워크스페이스 목록은 기존 `GET /workspaces`를 재사용한다.
- 계획 단계에서는 실제 DB migration을 자동 적용하지 않으며, 대상 DB 변경은 사용자 승인 후 별도로 수행한다.
- 사용자 요청이 없으므로 task별 Git commit 단계는 실행하지 않는다.
- 구현은 각 task에서 실패 테스트 확인 후 최소 구현과 리팩터링을 수행한다.

---

## 파일 구조

### 새 파일

- `backend/src/schemas/account.schema.ts`: 이름 변경과 비밀번호 변경 입력 계약
- `backend/src/services/account.service.ts`: 계정 조회·이름 변경·비밀번호 변경 유스케이스
- `backend/src/controllers/account.controller.ts`: HTTP 입력·응답과 refresh 쿠키 처리
- `backend/src/routes/account.routes.ts`: 인증된 `/account` 라우팅
- `backend/src/utils/auth-cookie.ts`: auth/account가 공유하는 refresh 쿠키 설정·삭제
- `backend/tests/account-schema.test.ts`: 계정 입력 schema 경계 테스트
- `backend/tests/account-service.test.ts`: 계정 유스케이스와 세션 전환 단위 테스트
- `backend/tests/account.test.ts`: `/account` HTTP 계약 테스트
- `backend/tests/auth-cookie.test.ts`: 공용 refresh 쿠키 유틸리티 계약 테스트
- `backend/src/db/migrations/0003_*.sql` 및 meta 파일: Drizzle이 생성하는 `session_version` migration

### 수정 파일

- `backend/src/db/schema/users.ts`: `sessionVersion` 컬럼
- `backend/tests/db-schema.test.ts`: 새 컬럼 노출 검증
- `backend/src/lib/jwt.ts`: access/refresh token `ver` claim
- `backend/tests/jwt.test.ts`: 버전 round-trip·legacy 호환 검증
- `backend/src/services/auth.service.ts`: 로그인 발급 버전과 refresh 버전 비교
- `backend/tests/auth-service.test.ts`: 로그인·refresh 버전 계약
- `backend/tests/auth.test.ts`: 기존 인증 API의 sessionVersion fixture와 회귀 테스트
- `backend/src/services/user.service.ts`: 이름 변경 및 비밀번호·버전 원자 갱신
- `backend/tests/user-service.test.ts`: 사용자 update query 테스트
- `backend/src/services/session.service.ts`: 다른 refresh 세션 키 best-effort 정리용 함수
- `backend/tests/session-service.test.ts`: SCAN batch와 보존 sid 테스트
- `backend/src/controllers/auth.controller.ts`: 공용 쿠키 유틸리티 사용
- `backend/src/routes/index.ts`: `/account` router mount
- `backend/src/constants/messages.ts`: 계정 validation·오류 메시지

---

### Task 1: 사용자 세션 버전 컬럼과 migration

**Files:**

- Modify: `backend/src/db/schema/users.ts`
- Modify: `backend/tests/db-schema.test.ts`
- Create: `backend/src/db/migrations/0003_*.sql`
- Modify: `backend/src/db/migrations/meta/_journal.json`
- Create: `backend/src/db/migrations/meta/0003_snapshot.json`

**Interfaces:**

- Produces: `users.sessionVersion: integer NOT NULL DEFAULT 0`
- Consumes: 기존 `users` Drizzle schema와 `db:generate` script

- [ ] **Step 1: 실패하는 schema 테스트 작성**

`backend/tests/db-schema.test.ts`에 컬럼 계약을 추가한다.

```ts
it("users schema exposes a sessionVersion column with default zero", () => {
  expect(schema.users.sessionVersion).toBeDefined();
  expect(schema.users.sessionVersion.notNull).toBe(true);
  expect(schema.users.sessionVersion.hasDefault).toBe(true);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --dir backend test -- tests/db-schema.test.ts`

Expected: FAIL — `schema.users.sessionVersion`이 존재하지 않는다.

- [ ] **Step 3: users schema에 컬럼 추가**

`backend/src/db/schema/users.ts`에서 `integer`를 import하고 다음 필드를 `passwordHash` 다음에 추가한다.

```ts
sessionVersion: integer("session_version").default(0).notNull(),
```

- [ ] **Step 4: schema 테스트 통과 확인**

Run: `pnpm --dir backend test -- tests/db-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Drizzle migration 생성**

Run: `pnpm --dir backend db:generate`

Expected: 새 `0003_*.sql`, snapshot, journal entry가 생성되고 SQL에 아래와 동등한 문장이 포함된다.

```sql
ALTER TABLE "users" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;
```

- [ ] **Step 6: migration 산출물 검증**

Run: `rg -n 'session_version|users' backend/src/db/migrations/0003_*.sql backend/src/db/migrations/meta/0003_snapshot.json`

Expected: migration SQL과 snapshot 모두 `session_version`, default `0`, not-null 계약을 가진다.

- [ ] **Step 7: Task 1 검증**

Run: `pnpm --dir backend test -- tests/db-schema.test.ts && git diff --check`

Expected: 모두 성공. `db:migrate`는 실행하지 않는다.

---

### Task 2: JWT 세션 버전 claim

**Files:**

- Modify: `backend/src/lib/jwt.ts`
- Modify: `backend/tests/jwt.test.ts`
- Modify: `backend/src/types/express.d.ts` (타입 import 전파 확인만 수행하며 직접 변경은 필요하지 않을 수 있음)

**Interfaces:**

- Produces: `AccessTokenPayload.ver: number`, `RefreshTokenPayload.ver: number`
- Produces: `signAccessToken({ sub, email, sid, ver }): Promise<string>`
- Produces: `signRefreshToken({ sub, sid, ver }): Promise<string>`
- Produces: `verifyAccessToken(token)`과 `verifyRefreshToken(token)`은 누락된 `ver`를 `0`으로 반환
- Consumes: Task 1의 `sessionVersion` 의미 계약

- [ ] **Step 1: 실패하는 round-trip 테스트 작성**

기존 모든 sign 호출에 `ver`를 추가하고 다음 assertion을 넣는다.

```ts
const accessToken = await signAccessToken({
  sub: "user-1",
  email: "user@example.com",
  sid: "sid-1",
  ver: 3,
});
expect((await verifyAccessToken(accessToken)).ver).toBe(3);

const refreshToken = await signRefreshToken({
  sub: "user-1",
  sid: "sid-1",
  ver: 3,
});
expect((await verifyRefreshToken(refreshToken)).ver).toBe(3);
```

- [ ] **Step 2: legacy token과 잘못된 버전 테스트 작성**

테스트 안에서 jose `SignJWT`와 test secret을 사용해 `ver` 없는 access/refresh token을 만들고 검증 결과가 `0`인지 확인한다. `ver: -1`, `ver: 1.5`, `ver: "1"` token은 검증을 거부해야 한다.

```ts
expect((await verifyRefreshToken(legacyRefreshToken)).ver).toBe(0);
await expect(verifyRefreshToken(negativeVersionToken)).rejects.toThrow();
await expect(verifyRefreshToken(fractionVersionToken)).rejects.toThrow();
await expect(verifyRefreshToken(stringVersionToken)).rejects.toThrow();
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --dir backend test -- tests/jwt.test.ts`

Expected: FAIL — sign 입력과 payload에 `ver`가 없다.

- [ ] **Step 4: JWT 타입과 sign 함수 구현**

두 payload interface에 `ver: number`를 추가하고 sign payload에도 필수 값으로 받는다.

```ts
export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  ver: number;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  ver: number;
  type: "refresh";
}
```

`SignJWT` private claim에 `ver: payload.ver`를 포함한다.

- [ ] **Step 5: verify 함수에 legacy normalization 구현**

두 verify 함수에서 다음과 같이 `ver`를 검증한다.

```ts
const ver = payload.ver ?? 0;
if (typeof ver !== "number" || !Number.isInteger(ver) || ver < 0) {
  throw new Error("Invalid token session version");
}
```

반환 객체에 `ver`를 포함한다. `types/express.d.ts`는 `AccessTokenPayload`를 참조하므로 별도 선언 중복 없이 자동 반영되는지 typecheck로 확인한다.

- [ ] **Step 6: Task 2 검증**

Run: `pnpm --dir backend test -- tests/jwt.test.ts`

Expected: JWT 테스트가 통과한다. 변경된 sign 함수 호출부의 TypeScript 오류는 Task 3에서 각 사용자 row의 실제 `sessionVersion`을 전달해 해소한다.

---

### Task 3: 로그인·refresh의 sessionVersion 결합

**Files:**

- Modify: `backend/src/services/auth.service.ts`
- Modify: `backend/tests/auth-service.test.ts`
- Modify: `backend/tests/auth.test.ts`

**Interfaces:**

- Consumes: Task 2의 `signAccessToken({ ..., ver })`, `signRefreshToken({ ..., ver })`
- Consumes: `getUserByEmail`, `getUserById` 결과의 `sessionVersion`
- Produces: 로그인 token은 DB의 현재 `sessionVersion`을 포함
- Produces: refresh는 token `ver === user.sessionVersion`일 때만 회전

- [ ] **Step 1: auth service fixture와 로그인 실패 테스트 수정**

`mockUser`, `seededUser`에 `sessionVersion: 0`을 추가한다. 로그인 성공 테스트에서 두 sign 함수 호출이 같은 버전으로 수행되는지 검증한다.

```ts
expect(jwtLib.signAccessToken).toHaveBeenCalledWith({
  sub: "user-1",
  email: "user@example.com",
  sid: expect.any(String),
  ver: 0,
});
expect(jwtLib.signRefreshToken).toHaveBeenCalledWith({
  sub: "user-1",
  sid: expect.any(String),
  ver: 0,
});
```

- [ ] **Step 2: refresh 버전 불일치 실패 테스트 작성**

```ts
vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
  sub: "user-1",
  sid: "sid-old",
  ver: 2,
  type: "refresh",
});
vi.mocked(userService.getUserById).mockResolvedValue({
  ...mockUser,
  sessionVersion: 3,
});

await expect(refresh("old-generation-token")).rejects.toMatchObject({
  status: 401,
  code: "INVALID_REFRESH_TOKEN",
});
expect(sessionService.deleteRefreshSession).toHaveBeenCalledWith(
  "user-1",
  "sid-old",
);
expect(jwtLib.signAccessToken).not.toHaveBeenCalled();
expect(sessionService.rotateRefreshSession).not.toHaveBeenCalled();
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --dir backend test -- tests/auth-service.test.ts tests/auth.test.ts`

Expected: FAIL — auth service가 버전을 전달·비교하지 않는다.

- [ ] **Step 4: 로그인 token에 현재 버전 전달**

`login`에서 두 sign 호출에 `ver: user.sessionVersion`을 추가한다. 사용자 응답에는 `sessionVersion`을 포함하지 않는다.

- [ ] **Step 5: refresh 버전 비교 구현**

`refresh`가 사용자를 찾은 직후 token 발급 전에 다음 분기를 추가한다.

```ts
if (payload.ver !== user.sessionVersion) {
  await deleteRefreshSession(user.id, payload.sid);
  throw new HttpError(
    401,
    "INVALID_REFRESH_TOKEN",
    ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
  );
}
```

새 access/refresh token에는 `ver: user.sessionVersion`을 전달한다.

- [ ] **Step 6: 기존 인증 통합 테스트 fixture 보정**

`backend/tests/auth.test.ts`의 모든 사용자 fixture에 `sessionVersion: 0`을 추가하고 기존 멀티 세션, 회전 재사용 탐지, 로그아웃 테스트가 그대로 통과하게 한다.

- [ ] **Step 7: Task 3 검증**

Run: `pnpm --dir backend test -- tests/auth-service.test.ts tests/auth.test.ts tests/jwt.test.ts && pnpm --dir backend build`

Expected: 기존 인증 동작과 새 버전 불일치 차단이 모두 PASS하고 TypeScript build가 통과한다.

---

### Task 4: 계정 입력 schema와 오류 메시지

**Files:**

- Create: `backend/src/schemas/account.schema.ts`
- Create: `backend/tests/account-schema.test.ts`
- Modify: `backend/src/constants/messages.ts`

**Interfaces:**

- Produces: `updateAccountSchema`, `UpdateAccountInput`
- Produces: `changePasswordSchema`, `ChangePasswordInput`
- Consumes: 기존 `passwordSchema`

- [ ] **Step 1: 오류 메시지 상수 추가**

```ts
ACCOUNT_NAME_REQUIRED: "이름을 입력해주세요",
ACCOUNT_NAME_TOO_LONG: "이름은 255자 이내로 입력해주세요",
ACCOUNT_NOT_FOUND: "계정을 찾을 수 없습니다",
CURRENT_PASSWORD_REQUIRED: "현재 비밀번호를 입력해주세요",
CURRENT_PASSWORD_MISMATCH: "현재 비밀번호가 올바르지 않습니다",
PASSWORD_CHANGED_REAUTH_REQUIRED:
  "비밀번호는 변경되었지만 로그인 갱신에 실패했습니다. 다시 로그인해주세요",
```

- [ ] **Step 2: 실패하는 schema 테스트 작성**

`backend/tests/account-schema.test.ts`에 다음 경계를 명시한다.

```ts
expect(updateAccountSchema.parse({ name: "  새 이름  " })).toEqual({
  name: "새 이름",
});
expect(updateAccountSchema.safeParse({ name: "   " }).success).toBe(false);
expect(updateAccountSchema.safeParse({ name: "a".repeat(256) }).success).toBe(
  false,
);

expect(
  changePasswordSchema.parse({
    currentPassword: "Old123!",
    newPassword: "New12345!",
  }),
).toEqual({ currentPassword: "Old123!", newPassword: "New12345!" });
expect(
  changePasswordSchema.safeParse({
    currentPassword: "",
    newPassword: "New12345!",
  }).success,
).toBe(false);
expect(
  changePasswordSchema.safeParse({
    currentPassword: "Old123!",
    newPassword: "weak",
  }).success,
).toBe(false);
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --dir backend test -- tests/account-schema.test.ts`

Expected: FAIL — account schema module이 없다.

- [ ] **Step 4: 최소 schema 구현**

```ts
const accountNameSchema = z
  .string({ error: ERROR_MESSAGES.ACCOUNT_NAME_REQUIRED })
  .trim()
  .min(1, ERROR_MESSAGES.ACCOUNT_NAME_REQUIRED)
  .max(255, ERROR_MESSAGES.ACCOUNT_NAME_TOO_LONG);

const currentPasswordSchema = z
  .string({ error: ERROR_MESSAGES.CURRENT_PASSWORD_REQUIRED })
  .min(1, ERROR_MESSAGES.CURRENT_PASSWORD_REQUIRED);

export const updateAccountSchema = z.object({ name: accountNameSchema });
export const changePasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: passwordSchema,
});
```

각 schema의 `z.infer` 타입을 export한다.

- [ ] **Step 5: Task 4 검증**

Run: `pnpm --dir backend test -- tests/account-schema.test.ts tests/auth-schema.test.ts`

Expected: 새 계정 schema와 기존 로그인 schema 테스트가 모두 PASS.

---

### Task 5: 사용자 계정 갱신 DB 함수

**Files:**

- Modify: `backend/src/services/user.service.ts`
- Modify: `backend/tests/user-service.test.ts`

**Interfaces:**

- Produces: `updateUserName(input: { userId: string; name: string })`
- Produces: `updateUserPasswordAndIncrementSessionVersion(input: { userId: string; passwordHash: string })`
- Return: Drizzle `returning()`의 첫 사용자 row 또는 `undefined`
- Consumes: Task 1의 `users.sessionVersion`

- [ ] **Step 1: update query mock 준비 및 실패 테스트 작성**

테스트의 DB mock에 `update: vi.fn()`을 추가하고 chain을 구성한다.

```ts
const returning = vi
  .fn()
  .mockResolvedValue([{ ...mockUser, name: "새 이름", sessionVersion: 0 }]);
const where = vi.fn().mockReturnValue({ returning });
const set = vi.fn().mockReturnValue({ where });
vi.mocked(db.update).mockReturnValue({ set } as never);

const result = await updateUserName({ userId: "user-1", name: "새 이름" });
expect(db.update).toHaveBeenCalledWith(users);
expect(set).toHaveBeenCalledWith({ name: "새 이름" });
expect(result?.name).toBe("새 이름");
```

비밀번호 함수는 `set` 인자에 새 hash와 SQL 증가식이 들어가고 반환 버전이 `1`인지 확인한다. 빈 returning은 `undefined`를 반환해야 한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --dir backend test -- tests/user-service.test.ts`

Expected: FAIL — 두 update 함수가 export되지 않는다.

- [ ] **Step 3: 이름 갱신 함수 구현**

```ts
export async function updateUserName({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [user] = await db
    .update(users)
    .set({ name })
    .where(eq(users.id, userId))
    .returning();
  return user;
}
```

- [ ] **Step 4: 비밀번호와 버전 원자 갱신 함수 구현**

```ts
export async function updateUserPasswordAndIncrementSessionVersion({
  userId,
  passwordHash,
}: {
  userId: string;
  passwordHash: string;
}) {
  const [user] = await db
    .update(users)
    .set({
      passwordHash,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, userId))
    .returning();
  return user;
}
```

- [ ] **Step 5: 기존 upsert 계약 확인**

`upsertUserWithDefaultWorkspace`는 신규 row에 DB default `0`을 적용하고 기존 row의 `sessionVersion`은 변경하지 않아야 한다. 기존 `onConflictDoUpdate` set에 `sessionVersion`을 추가하지 않는다.

- [ ] **Step 6: Task 5 검증**

Run: `pnpm --dir backend test -- tests/user-service.test.ts tests/db-schema.test.ts`

Expected: 조회·프로비저닝 회귀 테스트와 두 갱신 테스트가 PASS.

---

### Task 6: 다른 refresh 세션 키 정리

**Files:**

- Modify: `backend/src/services/session.service.ts`
- Modify: `backend/tests/session-service.test.ts`

**Interfaces:**

- Produces: `deleteOtherRefreshSessions(userId: string, keepSid: string): Promise<void>`
- Consumes: iovalkey `scan(cursor, "MATCH", pattern, "COUNT", count)`와 `del(...keys)`
- Security boundary: DB/JWT `sessionVersion`; 이 함수는 best-effort storage cleanup만 수행

- [ ] **Step 1: Valkey mock에 SCAN 지원 추가**

```ts
vi.mock("@/cache/valkey", () => ({
  valkey: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
    scan: vi.fn(),
  },
}));
```

- [ ] **Step 2: 실패하는 multi-batch 테스트 작성**

```ts
vi.mocked(valkey.scan)
  .mockResolvedValueOnce(["7", ["refresh:user-1:old-a", "refresh:user-1:keep"])
  .mockResolvedValueOnce(["0", ["refresh:user-1:old-b"]]);

await deleteOtherRefreshSessions("user-1", "keep");

expect(valkey.scan).toHaveBeenNthCalledWith(
  1,
  "0",
  "MATCH",
  "refresh:user-1:*",
  "COUNT",
  100,
);
expect(valkey.del).toHaveBeenCalledWith("refresh:user-1:old-a");
expect(valkey.del).toHaveBeenCalledWith("refresh:user-1:old-b");
expect(valkey.del).not.toHaveBeenCalledWith("refresh:user-1:keep");
```

키가 없고 cursor가 `0`이면 `del`을 호출하지 않는 테스트도 추가한다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm --dir backend test -- tests/session-service.test.ts`

Expected: FAIL — cleanup 함수가 없다.

- [ ] **Step 4: SCAN cleanup 구현**

```ts
export async function deleteOtherRefreshSessions(
  userId: string,
  keepSid: string,
): Promise<void> {
  let cursor = "0";
  const keepKey = sessionKey(userId, keepSid);

  do {
    const [nextCursor, keys] = await valkey.scan(
      cursor,
      "MATCH",
      `refresh:${userId}:*`,
      "COUNT",
      100,
    );
    const staleKeys = keys.filter((key) => key !== keepKey);
    if (staleKeys.length > 0) {
      await valkey.del(...staleKeys);
    }
    cursor = nextCursor;
  } while (cursor !== "0");
}
```

- [ ] **Step 5: Task 6 검증**

Run: `pnpm --dir backend test -- tests/session-service.test.ts`

Expected: 기존 save/rotate/delete와 새 cleanup 테스트가 모두 PASS.

---

### Task 7: 공용 refresh 쿠키 유틸리티

**Files:**

- Create: `backend/src/utils/auth-cookie.ts`
- Modify: `backend/src/controllers/auth.controller.ts`
- Create: `backend/tests/auth-cookie.test.ts`
- Modify: `backend/tests/auth.test.ts`

**Interfaces:**

- Produces: `setRefreshTokenCookie(res: Response, token: string): void`
- Produces: `clearRefreshTokenCookie(res: Response): void`
- Consumes: `getEnv().NODE_ENV`

- [ ] **Step 1: 기존 auth 쿠키 회귀 테스트 확인**

Run: `pnpm --dir backend test -- tests/auth.test.ts`

Expected: 현재 baseline PASS.

- [ ] **Step 2: 쿠키 함수 이동**

`auth.controller.ts`의 `REFRESH_TOKEN_COOKIE`, max-age, option 생성, set/clear 함수를 `auth-cookie.ts`로 옮기고 두 공개 함수만 export한다.

```ts
export function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    ...refreshTokenCookieOptions(),
    maxAge: 14 * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshTokenCookie(res: Response) {
  res.clearCookie("refreshToken", refreshTokenCookieOptions());
}
```

`auth.controller.ts`는 두 함수를 import하고 기존 로컬 정의를 제거한다. refresh cookie 읽기 이름은 별도 export 없이 controller 상수 또는 공용 `REFRESH_TOKEN_COOKIE` export 중 한 방식으로 일관되게 유지한다.

- [ ] **Step 3: 쿠키 계약 회귀 확인**

Run: `pnpm --dir backend test -- tests/auth.test.ts`

Expected: 로그인/refresh/logout의 HttpOnly, SameSite, Path, Max-Age, clear 동작이 변경 없이 PASS.

- [ ] **Step 4: Task 7 정적 검증**

Run: `pnpm --dir backend build && pnpm --dir backend lint`

Expected: 중복 쿠키 구현 없이 build/lint PASS.

---

### Task 8: 계정 서비스 유스케이스

**Files:**

- Create: `backend/src/services/account.service.ts`
- Create: `backend/tests/account-service.test.ts`

**Interfaces:**

- Produces: `AccountUser = { id: string; name: string; email: string }`
- Produces: `getAccount(userId: string): Promise<AccountUser>`
- Produces: `updateAccount(input: { userId: string; name: string }): Promise<AccountUser>`
- Produces: `changeAccountPassword(input: { userId: string; currentPassword: string; newPassword: string }): Promise<{ accessToken: string; refreshToken: string; user: AccountUser }>`
- Consumes: user, password, JWT, session service 함수

- [ ] **Step 1: 의존성 mock과 안전한 사용자 매퍼 테스트 작성**

`@/services/user.service`, `@/lib/password`, `@/lib/jwt`, `@/services/session.service`, `node:crypto`를 mock한다. user fixture는 `passwordHash`, `sessionVersion`을 포함한다.

```ts
expect(await getAccount("user-1")).toEqual({
  id: "user-1",
  name: "Test User",
  email: "user@example.com",
});
```

사용자가 없으면 두 조회/갱신 유스케이스가 `404 ACCOUNT_NOT_FOUND`를 던져야 한다.

- [ ] **Step 2: 이름 변경 실패·성공 테스트 작성**

```ts
vi.mocked(userService.updateUserName).mockResolvedValue({
  ...mockUser,
  name: "새 이름",
});
await expect(
  updateAccount({ userId: "user-1", name: "새 이름" }),
).resolves.toEqual({
  id: "user-1",
  name: "새 이름",
  email: "user@example.com",
});
```

- [ ] **Step 3: 현재 비밀번호 불일치 테스트 작성**

```ts
vi.mocked(passwordLib.comparePassword).mockResolvedValue(false);

await expect(
  changeAccountPassword({
    userId: "user-1",
    currentPassword: "Wrong123!",
    newPassword: "New12345!",
  }),
).rejects.toMatchObject({ status: 400, code: "CURRENT_PASSWORD_MISMATCH" });

expect(passwordLib.hashPassword).not.toHaveBeenCalled();
expect(
  userService.updateUserPasswordAndIncrementSessionVersion,
).not.toHaveBeenCalled();
expect(sessionService.saveRefreshSession).not.toHaveBeenCalled();
```

- [ ] **Step 4: 성공적인 현재 세션 전환 테스트 작성**

새 user row의 `sessionVersion: 4`, 고정 `randomUUID()`의 `sid-new`, sign 결과, Valkey 저장과 cleanup을 검증한다.

```ts
expect(jwtLib.signAccessToken).toHaveBeenCalledWith({
  sub: "user-1",
  email: "user@example.com",
  sid: "sid-new",
  ver: 4,
});
expect(jwtLib.signRefreshToken).toHaveBeenCalledWith({
  sub: "user-1",
  sid: "sid-new",
  ver: 4,
});
expect(sessionService.saveRefreshSession).toHaveBeenCalledWith(
  "user-1",
  "sid-new",
  "refresh-new",
);
expect(sessionService.deleteOtherRefreshSessions).toHaveBeenCalledWith(
  "user-1",
  "sid-new",
);
```

- [ ] **Step 5: 저장 실패와 cleanup 실패 테스트 작성**

- token 발급 또는 새 세션 저장이 실패하면 원인을 error 로그로 남기고 `503 PASSWORD_CHANGED_REAUTH_REQUIRED`를 던지며 cleanup을 호출하지 않는다.
- cleanup만 실패하면 logger warn을 호출하고 성공 결과는 그대로 반환한다.

```ts
vi.mocked(sessionService.deleteOtherRefreshSessions).mockRejectedValue(
  new Error("cleanup failed"),
);
await expect(changeAccountPassword(validInput)).resolves.toMatchObject({
  accessToken: "access-new",
  refreshToken: "refresh-new",
});
expect(logger.warn).toHaveBeenCalledWith(
  { err: expect.any(Error) },
  "Old refresh session cleanup failed after password change",
);
```

logger mock 또는 spy는 token·password·userId가 인자에 포함되지 않는지 확인한다.

- [ ] **Step 6: 테스트 실패 확인**

Run: `pnpm --dir backend test -- tests/account-service.test.ts`

Expected: FAIL — account service module이 없다.

- [ ] **Step 7: 계정 조회·이름 변경 구현**

공통 `toAccountUser` 매퍼로 `id`, `name`, `email`만 반환한다. 사용자 없음은 다음 오류로 변환한다.

```ts
throw new HttpError(404, "ACCOUNT_NOT_FOUND", ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
```

- [ ] **Step 8: 비밀번호 변경과 새 세션 발급 구현**

```ts
const user = await getUserById(input.userId);
if (!user) throw accountNotFound();

const matches = await comparePassword(input.currentPassword, user.passwordHash);
if (!matches) {
  throw new HttpError(
    400,
    "CURRENT_PASSWORD_MISMATCH",
    ERROR_MESSAGES.CURRENT_PASSWORD_MISMATCH,
  );
}

const passwordHash = await hashPassword(input.newPassword);
const updated = await updateUserPasswordAndIncrementSessionVersion({
  userId: input.userId,
  passwordHash,
});
if (!updated) throw accountNotFound();

const sid = randomUUID();
let accessToken: string;
let refreshToken: string;
try {
  [accessToken, refreshToken] = await Promise.all([
    signAccessToken({
      sub: updated.id,
      email: updated.email,
      sid,
      ver: updated.sessionVersion,
    }),
    signRefreshToken({ sub: updated.id, sid, ver: updated.sessionVersion }),
  ]);
  await saveRefreshSession(updated.id, sid, refreshToken);
} catch (err) {
  logger.error(
    { err },
    "Current session transition failed after password change",
  );
  throw new HttpError(
    503,
    "PASSWORD_CHANGED_REAUTH_REQUIRED",
    ERROR_MESSAGES.PASSWORD_CHANGED_REAUTH_REQUIRED,
  );
}

try {
  await deleteOtherRefreshSessions(updated.id, sid);
} catch (err) {
  logger.warn(
    { err },
    "Old refresh session cleanup failed after password change",
  );
}
```

반환 객체는 token 두 개와 안전한 user만 포함한다.

- [ ] **Step 9: Task 8 검증**

Run: `pnpm --dir backend test -- tests/account-service.test.ts tests/user-service.test.ts tests/session-service.test.ts`

Expected: 계정 유스케이스와 모든 하위 서비스 테스트 PASS.

---

### Task 9: `/account` HTTP API와 라우팅

**Files:**

- Create: `backend/src/controllers/account.controller.ts`
- Create: `backend/src/routes/account.routes.ts`
- Create: `backend/tests/account.test.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/tests/app.test.ts`

**Interfaces:**

- Consumes: Task 4 schema, Task 7 cookie utility, Task 8 account service
- Produces: `GET /account`
- Produces: `PATCH /account`
- Produces: `PATCH /account/password`

- [ ] **Step 1: 테스트 app과 account service mock 작성**

```ts
vi.mock("@/services/account.service");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/account", accountRouter);
  app.use(errorHandlerMiddleware);
  return app;
}
```

인증 테스트에는 실제 `signAccessToken({ sub, email, sid, ver: 0 })`으로 bearer token을 만든다.

- [ ] **Step 2: 계정 조회 API 실패·성공 테스트 작성**

- bearer token 없음 → `401`
- service의 `ACCOUNT_NOT_FOUND` → `404`
- 성공 → `200 { user }`
- 응답 JSON 문자열에 `passwordHash`, `sessionVersion`이 없음

```ts
expect(response.body).toEqual({
  user: { id: "user-1", name: "Test User", email: "user@example.com" },
});
expect(JSON.stringify(response.body)).not.toContain("passwordHash");
expect(JSON.stringify(response.body)).not.toContain("sessionVersion");
```

- [ ] **Step 3: 이름 변경 API 테스트 작성**

- 공백 이름과 256자 이름 → `400 VALIDATION_ERROR`, service 미호출
- `"  새 이름  "` → service에는 `"새 이름"` 전달
- 성공 → `200 { user }`

- [ ] **Step 4: 비밀번호 변경 API 테스트 작성**

- 현재 비밀번호 누락·약한 새 비밀번호 → `400 VALIDATION_ERROR`
- 현재 비밀번호 불일치 → `400 CURRENT_PASSWORD_MISMATCH`
- 성공 → `200`, body에는 새 access token과 user만 존재
- refresh token은 body에 없고 Set-Cookie에 HttpOnly, SameSite=Lax, Path=/auth/refresh, Max-Age가 있음
- `503 PASSWORD_CHANGED_REAUTH_REQUIRED`이면 기존 refresh 쿠키를 clear하는 Set-Cookie가 내려감
- 현재 비밀번호 불일치와 DB 갱신 전 일반 오류에서는 refresh 쿠키를 지우지 않음

```ts
expect(response.body).toEqual({
  accessToken: "access-new",
  user: { id: "user-1", name: "Test User", email: "user@example.com" },
});
expect(response.body.refreshToken).toBeUndefined();
expect(response.headers["set-cookie"]).toEqual(
  expect.arrayContaining([
    expect.stringMatching(/refreshToken=.*HttpOnly.*Path=\/auth\/refresh/i),
  ]),
);
```

- [ ] **Step 5: 테스트 실패 확인**

Run: `pnpm --dir backend test -- tests/account.test.ts`

Expected: FAIL — controller/router가 없다.

- [ ] **Step 6: controller 구현**

```ts
export async function getAccountHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ user: await getAccount(user.sub) });
}

export async function updateAccountHandler(req: Request, res: Response) {
  const authUser = requireUser(req);
  const input = parseOrThrow(updateAccountSchema, req.body);
  const user = await updateAccount({ userId: authUser.sub, name: input.name });
  res.status(200).json({ user });
}

export async function changeAccountPasswordHandler(
  req: Request,
  res: Response,
) {
  const authUser = requireUser(req);
  const input = parseOrThrow(changePasswordSchema, req.body);

  try {
    const result = await changeAccountPassword({
      userId: authUser.sub,
      ...input,
    });
    setRefreshTokenCookie(res, result.refreshToken);
    res
      .status(200)
      .json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    if (
      err instanceof HttpError &&
      err.code === "PASSWORD_CHANGED_REAUTH_REQUIRED"
    ) {
      clearRefreshTokenCookie(res);
    }
    throw err;
  }
}
```

- [ ] **Step 7: router와 root mount 구현**

```ts
export const accountRouter = Router();
accountRouter.get("/", authenticate, asyncHandler(getAccountHandler));
accountRouter.patch("/", authenticate, asyncHandler(updateAccountHandler));
accountRouter.patch(
  "/password",
  authenticate,
  asyncHandler(changeAccountPasswordHandler),
);
```

`backend/src/routes/index.ts`에 `router.use("/account", accountRouter)`를 추가한다.

- [ ] **Step 8: Account API 테스트 통과 확인**

Run: `pnpm --dir backend test -- tests/account.test.ts`

Expected: 모든 계정 HTTP 계약 PASS.

- [ ] **Step 9: 루트 router mount 테스트 작성**

`backend/tests/app.test.ts`에 인증 없이 `GET /account`를 호출하면 unknown-route `404`가 아니라 account router의 `401 UNAUTHORIZED`가 반환되는 smoke test를 추가한다.

```ts
it("mounts the authenticated account router", async () => {
  const response = await request(createApp()).get("/account");
  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe("UNAUTHORIZED");
});
```

현재 세션의 새 버전 token 발급은 `account-service.test.ts`, 다른 세션의 이전 버전 거부는 `auth-service.test.ts`, token/cookie HTTP 응답은 `account.test.ts`에서 각각 검증한다.

- [ ] **Step 10: Task 9 검증**

Run: `pnpm --dir backend test -- tests/account.test.ts tests/auth.test.ts tests/account-service.test.ts tests/auth-service.test.ts tests/app.test.ts`

Expected: 계정 API와 기존 인증 API 회귀 테스트 PASS.

---

### Task 10: 전체 검증과 구현 결과 문서화

**Files:**

- Modify: `docs/superpowers/plans/2026-09-10-account-settings-backend-implementation-plan.md`
- Inspect: 모든 작업 diff

**Interfaces:**

- Consumes: Task 1~9의 전체 구현
- Produces: 검증 증거와 `Implementation Results`

- [ ] **Step 1: 변경 파일 formatter 적용**

Run:

```bash
pnpm --dir backend exec prettier --write \
  src/db/schema/users.ts \
  src/lib/jwt.ts \
  src/services/auth.service.ts \
  src/services/user.service.ts \
  src/services/session.service.ts \
  src/services/account.service.ts \
  src/schemas/account.schema.ts \
  src/controllers/auth.controller.ts \
  src/controllers/account.controller.ts \
  src/routes/account.routes.ts \
  src/routes/index.ts \
  src/utils/auth-cookie.ts \
  src/constants/messages.ts \
  tests/db-schema.test.ts \
  tests/jwt.test.ts \
  tests/auth-service.test.ts \
  tests/auth.test.ts \
  tests/user-service.test.ts \
  tests/session-service.test.ts \
  tests/account-schema.test.ts \
  tests/account-service.test.ts \
  tests/account.test.ts \
  tests/auth-cookie.test.ts \
  tests/app.test.ts
```

Expected: 나열한 모든 구현·테스트 파일의 formatter가 성공한다.

- [ ] **Step 2: 관련 테스트 실행**

Run:

```bash
pnpm --dir backend test -- \
  tests/account-schema.test.ts \
  tests/account-service.test.ts \
  tests/account.test.ts \
  tests/auth-service.test.ts \
  tests/auth.test.ts \
  tests/jwt.test.ts \
  tests/session-service.test.ts \
  tests/user-service.test.ts \
  tests/db-schema.test.ts
```

Expected: 모든 관련 테스트 PASS.

- [ ] **Step 3: 전체 테스트 실행**

Run: `pnpm --dir backend test`

Expected: 전체 Vitest suite PASS.

- [ ] **Step 4: lint와 build 실행**

Run: `pnpm --dir backend lint && pnpm --dir backend build`

Expected: ESLint와 TypeScript production build PASS.

- [ ] **Step 5: migration과 diff 검사**

Run:

```bash
rg -n 'session_version' backend/src/db/migrations/0003_*.sql backend/src/db/migrations/meta/0003_snapshot.json
git diff --check
git status --short
git diff --stat
git diff -- backend/src backend/tests backend/src/db/migrations docs/superpowers
```

Expected: migration 계약이 확인되고 whitespace 오류가 없으며 unrelated change가 없다. 기존 사용자 변경이 있으면 수정하지 않고 결과에 구분해 기록한다.

- [ ] **Step 6: 설계 대비 최종 점검**

다음을 diff와 테스트 이름으로 대조한다.

- `GET /account`, `PATCH /account`, `PATCH /account/password`
- 현재 비밀번호 불일치 `400 CURRENT_PASSWORD_MISMATCH`
- 현재 기기의 새 sid/access/refresh token
- 다른 refresh 세션의 버전 불일치 차단
- access token 15분 자연 만료 유지
- refresh token body 비노출과 HttpOnly cookie
- `passwordHash`, `sessionVersion` 응답 비노출
- 기존 `/auth/login`, `/auth/refresh`, `/auth/logout` 회귀 없음

- [x] **Step 7: Implementation Results 기록**

일반 문구를 그대로 두지 않고 실제 diff와 명령 결과로 교체한다.

- [x] **Step 8: 완료 전 검증 재확인**

Run: `git diff --check && git status --short`

Expected: 문서 갱신 후에도 diff 오류가 없고, commit·push·PR은 수행하지 않는다.

## Implementation Results

### 실제 변경 내용

- `GET /account`로 인증된 사용자의 안전한 계정 필드(`id`, `name`, `email`)를 조회한다.
- `PATCH /account`에서 이름을 trim·검증하고 `updateAccount` 유스케이스로 갱신한다.
- `PATCH /account/password`에서 현재 비밀번호를 확인한 뒤 새 해시와 `sessionVersion`을 원자적으로 저장하고, 새 sid/access token/refresh token으로 현재 기기를 자동 전환한다.
- `users.sessionVersion` migration, JWT `ver` claim, refresh 시 버전 검증, Valkey의 기존 refresh 키 best-effort 정리를 추가했다.
- sessionVersion 불일치 시 stale 키 삭제가 실패해도 `401 INVALID_REFRESH_TOKEN`을 유지하도록 정리 오류를 warn 로그로 격리했다.
- 공용 refresh 쿠키 유틸리티를 분리하고 계정·인증 controller가 동일한 HttpOnly/SameSite/Path 정책을 사용하게 했다.
- 입력 schema, 서비스, JWT·세션·쿠키·HTTP 회귀 테스트를 추가했다.

### 계획과 달라진 점

- 이름 변경 경계는 `/account/profile`이나 `updateAccountProfile`이 아닌 `/account`와 `updateAccount`로 확정했다. 계정 설정의 단일 리소스 의미를 유지하고 사용자가 지적한 `profile` 명칭 혼동을 제거하기 위한 조정이다.
- 비밀번호 변경 유스케이스는 기존 sid를 입력으로 받지 않고 서비스 내부에서 새 sid를 발급한다. 현재 세션을 재사용하지 않고 완전히 교체한다는 보안 결정을 코드와 일치시켰다.
- 새 refresh 세션 저장 실패는 DB 비밀번호 변경 이후의 부분 실패이므로 `503 PASSWORD_CHANGED_REAUTH_REQUIRED`를 반환하고 쿠키를 제거한다. 정리 실패는 새 세션을 취소하지 않고 warn 로그 후 성공시킨다.
- `updateUserName`은 실제 구현의 객체 입력(`{ userId, name }`)으로 문서 계약을 정리했다.

### 검증 결과

- `pnpm exec prettier --write ...`: 변경된 구현·테스트 파일 formatter 적용 완료.
- `pnpm lint`: ESLint 오류 0건.
- `pnpm test`: 24개 파일, 214개 테스트 통과.
- `pnpm build`: TypeScript와 `tsc-alias` 빌드 통과.
- `git diff --check`: whitespace 오류 없음.
- `rg -n 'session_version' backend/src/db/migrations/0003_silly_echo.sql backend/src/db/migrations/meta/0003_snapshot.json`: `session_version` migration 계약 확인.
- `pnpm db:migrate`: 앱 DB 계정으로 실행 시 `drizzle` schema/database 권한 부족으로 종료됨. 이 시도에서 schema 변경은 발생하지 않았다.
- 사용자 승인 후 로컬 `in2white` DB 관리자 transaction으로 `0003_silly_echo.sql`의 `session_version` 추가와 Drizzle journal row를 함께 적용했다.
- DB 확인: `public.users.session_version`이 `integer DEFAULT 0 NOT NULL`로 존재하고, migration hash row가 1건 기록됨.
- 실제 `POST /auth/login` smoke: 유효 형식의 잘못된 비밀번호에 `401 INVALID_CREDENTIALS` 반환. 기존 `session_version does not exist` 500은 재현되지 않았다.

### 남은 후속 작업

- staging/production DB에도 동일한 `0003_silly_echo.sql` migration을 DB owner 또는 migration 전용 권한으로 적용해야 한다.
- 현재 로컬 앱 DB 계정은 `drizzle` schema 사용·생성 권한이 없으므로, 향후 `pnpm db:migrate`를 앱 계정으로 운영하려면 migration 권한을 별도로 정리해야 한다.
- 프론트엔드에서 비밀번호 변경 응답의 새 access token을 저장하고, `503 PASSWORD_CHANGED_REAUTH_REQUIRED` 시 로그인 화면으로 전환해야 한다.
- 기존 access token은 설계대로 최대 15분까지 유효하다. 즉시 폐기가 필요하면 별도 access-token blacklist/짧은 TTL 정책을 추가해야 한다.
- 이메일 변경, 계정 삭제, 세션 목록·개별 로그아웃 API는 현재 범위에 포함하지 않았다.
