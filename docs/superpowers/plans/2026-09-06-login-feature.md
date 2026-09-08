# 로그인 기능 (백엔드) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이메일/비밀번호 로그인, accessToken/refreshToken 발급·재발급(회전)·폐기를 제공하는 `/auth/login`, `/auth/refresh`, `/auth/logout` 백엔드 API를 구현한다.

**Architecture:** 기존 routes → controllers → services → db/schema 계층 구조를 그대로 따른다. accessToken(15분)은 응답 body로, refreshToken(2주)은 httpOnly 쿠키로 전달한다. refreshToken은 세션 식별자(`sid`)별로 Valkey에 해시로 저장되어(멀티 세션) 즉시 폐기·회전이 가능하다.

**Tech Stack:** Express, TypeScript(ESM), jose(JWT), bcrypt(비밀번호 해싱), iovalkey(Valkey 클라이언트), drizzle-orm(PostgreSQL), zod(검증), cookie-parser, vitest + supertest(테스트, db/valkey는 `vi.mock`으로 모킹).

**Spec:** [`docs/superpowers/specs/2026-09-06-login-feature-design.md`](../specs/2026-09-06-login-feature-design.md)

## Global Constraints

- accessToken 유효기간: 15분. refreshToken 유효기간: 2주.
- refreshToken은 응답 body에 절대 포함하지 않는다 — httpOnly, `path: "/auth/refresh"` 쿠키로만 전달한다.
- accessToken은 응답 body로 반환한다.
- 세션 정책: 멀티 세션. Valkey 키는 `refresh:{userId}:{sid}`, 값은 refreshToken의 sha256 해시, TTL 2주.
- refresh 시 accessToken + refreshToken 모두 재발급(같은 `sid` 유지)하고, Valkey 값 교체는 Lua `EVAL` 기반 compare-and-set으로 원자적으로 수행한다(단순 GET 후 SET은 동시 요청 간 race condition을 만들어 회전/로그아웃 보장이 깨진다).
- refresh 시 제시된 refreshToken이 Valkey에 저장된 현재 해시와 다르면(이미 회전되어 폐기된 토큰 재사용) 단순히 거부만 하는 게 아니라 해당 `sid` 세션 전체를 삭제한다 — 탈취된 토큰이 나중에 재사용돼도 무력화되도록 하는 reuse detection이다. 이 설계의 트레이드오프로, 클라이언트가 같은 refreshToken으로 자동 재시도를 하면 정상 세션도 강제 종료될 수 있다 — 프론트엔드 구현 시 `/auth/refresh` 실패를 자동 재시도하지 말고 재로그인으로 유도해야 한다(스펙 문서 §1 Non-Goals 참고).
- accessToken/refreshToken 모두 서명 시 `jti`(랜덤 UUID)를 포함한다 — HS256은 결정적 서명이라 동일 payload(sub/sid)를 같은 초(iat)에 두 번 서명하면 완전히 동일한 토큰이 나올 수 있기 때문이다.
- 로그인 실패(계정 없음/비밀번호 불일치)는 항상 동일한 `401 INVALID_CREDENTIALS` + 동일 메시지로 응답한다(계정 존재 여부 유추 방지). 계정이 없을 때도 더미 해시로 bcrypt compare를 실행해 타이밍 차이를 없앤다.
- `/auth/refresh`는 `Origin` 헤더가 있는데 `CORS_ORIGIN`과 다르면 `403 INVALID_ORIGIN`으로 거부한다(CSRF 방어, sameSite가 향후 cross-site 배포로 "none"이 되는 경우를 대비).
- 모든 새 파일은 `@/*` path alias(`baseUrl: "."`, `paths: { "@/*": ["src/*"] }`)를 사용해 import한다.
- 패키지 매니저는 pnpm. 이 저장소엔 실제로 붙는 테스트 DB/Valkey 인프라가 없으므로, 모든 테스트는 `vi.mock`으로 `@/db/client`, `@/cache/valkey`를 모킹해서 작성한다.
- 에러 응답 포맷은 기존 컨벤션을 따른다: `{ error: { message, code } }`.

---

## Task 1: 의존성 추가 및 환경변수 스키마 확장

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/config/env.ts`
- Modify: `backend/.env.example`
- Modify: `backend/vitest.config.ts`
- Modify: `backend/tests/env.test.ts`

**Interfaces:**
- Produces: `getEnv().JWT_REFRESH_SECRET: string`, `getEnv().CORS_ORIGIN: string` — 이후 모든 Task가 사용.

- [ ] **Step 1: package.json에 새 의존성 추가**

`backend/package.json`의 `dependencies`에 추가:

```json
    "bcrypt": "^6.0.0",
    "cookie-parser": "^1.4.7",
```

`devDependencies`에 추가:

```json
    "@types/bcrypt": "^6.0.0",
    "@types/cookie-parser": "^1.4.10",
```

- [ ] **Step 2: 의존성 설치**

Run: `cd backend && pnpm install`
Expected: `node_modules`가 생성되고 설치가 에러 없이 끝난다.

- [ ] **Step 3: 설치 후 기존 테스트가 통과하는지 확인 (베이스라인 확인)**

Run: `cd backend && pnpm test`
Expected: 기존 테스트 전부 PASS (아직 아무 기능도 변경하지 않았으므로).

- [ ] **Step 4: 실패하는 테스트 작성 — env 스키마에 JWT_REFRESH_SECRET, CORS_ORIGIN 추가**

`backend/tests/env.test.ts` 전체를 다음으로 교체:

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/config/env";

describe("parseEnv", () => {
  const validSource = {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    VALKEY_URL: "redis://localhost:6379",
    JWT_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
  };

  it("applies defaults for NODE_ENV and PORT", () => {
    const result = parseEnv(validSource);
    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(4000);
  });

  it("applies a default for CORS_ORIGIN", () => {
    const result = parseEnv(validSource);
    expect(result.CORS_ORIGIN).toBe("http://localhost:5173");
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL: _drop, ...rest } = validSource;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when JWT_SECRET is too short", () => {
    expect(() => parseEnv({ ...validSource, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });

  it("throws when JWT_REFRESH_SECRET is too short", () => {
    expect(() => parseEnv({ ...validSource, JWT_REFRESH_SECRET: "short" })).toThrow(
      /JWT_REFRESH_SECRET/,
    );
  });
});
```

- [ ] **Step 5: 테스트가 실패하는지 확인**

Run: `cd backend && pnpm test tests/env.test.ts`
Expected: FAIL — `JWT_REFRESH_SECRET`가 스키마에 없어서 `validSource`에 있는 값이 무시되고, `CORS_ORIGIN` 관련 assertion과 `JWT_REFRESH_SECRET` 관련 assertion이 실패한다.

- [ ] **Step 6: env.ts에 스키마 추가**

`backend/src/config/env.ts`의 `envSchema` 정의를 다음으로 교체:

```ts
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  VALKEY_URL: z.string().min(1, "VALKEY_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN is required").default("http://localhost:5173"),
});
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd backend && pnpm test tests/env.test.ts`
Expected: PASS

- [ ] **Step 8: vitest.config.ts에 테스트용 JWT_REFRESH_SECRET 추가**

`backend/vitest.config.ts`의 `test.env` 블록을 다음으로 교체:

```ts
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      VALKEY_URL: "redis://localhost:6379",
      JWT_SECRET: "test-secret-key-with-at-least-32-characters",
      JWT_REFRESH_SECRET: "test-refresh-secret-key-with-at-least-32-chars",
    },
```

- [ ] **Step 9: .env.example에 새 값 추가**

`backend/.env.example` 파일을 열어 기존 `JWT_SECRET=...` 라인 아래에 다음 두 줄을 추가한다 (기존 파일의 값 포맷을 그대로 따를 것):

```
JWT_REFRESH_SECRET=change-me-to-a-random-32-character-secret
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 10: 전체 테스트 재확인**

Run: `cd backend && pnpm test`
Expected: PASS (env 관련 변경으로 다른 테스트가 깨지지 않아야 한다)

- [ ] **Step 11: 커밋**

```bash
cd backend
git add package.json pnpm-lock.yaml src/config/env.ts .env.example vitest.config.ts tests/env.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: JWT_REFRESH_SECRET, CORS_ORIGIN 환경변수 및 로그인 관련 의존성 추가

- bcrypt, cookie-parser 의존성 추가
EOF
)"
```

---

## Task 2: HttpError 및 error-handler 미들웨어 확장

**Files:**
- Create: `backend/src/utils/http-error.ts`
- Modify: `backend/src/middlewares/error-handler.middleware.ts`
- Modify: `backend/tests/middlewares.test.ts`

**Interfaces:**
- Produces: `class HttpError extends Error { status: number; code: string; constructor(status: number, code: string, message: string) }` — 이후 auth.service.ts, auth.controller.ts에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/middlewares.test.ts`에서 기존 `describe("errorHandlerMiddleware", ...)` 블록 **다음에** 아래 블록을 추가하고, 파일 상단 import에 `import { HttpError } from "@/utils/http-error";`를 추가한다:

```ts
describe("errorHandlerMiddleware with HttpError", () => {
  it("responds with the HttpError's own status and code", () => {
    const res = createMockResponse();

    errorHandlerMiddleware(
      new HttpError(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다"),
      {} as Request,
      res,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "이메일 또는 비밀번호가 올바르지 않습니다", code: "INVALID_CREDENTIALS" },
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && pnpm test tests/middlewares.test.ts`
Expected: FAIL — `@/utils/http-error` 모듈이 없어서 import 에러.

- [ ] **Step 3: HttpError 클래스 작성**

`backend/src/utils/http-error.ts` 생성:

```ts
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}
```

- [ ] **Step 4: error-handler 미들웨어 수정**

`backend/src/middlewares/error-handler.middleware.ts` 전체를 다음으로 교체:

```ts
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";

export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error({ err }, "Unhandled error");

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { message: err.message, code: err.code },
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";

  res.status(500).json({
    error: {
      message,
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && pnpm test tests/middlewares.test.ts`
Expected: PASS (기존 500 케이스 테스트도 함께 통과해야 한다)

- [ ] **Step 6: 커밋**

```bash
cd backend
git add src/utils/http-error.ts src/middlewares/error-handler.middleware.ts tests/middlewares.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: 상태 코드를 지정할 수 있는 HttpError 도입

- error-handler가 HttpError면 지정된 status/code를, 아니면 기존처럼 500을 반환
EOF
)"
```

---

## Task 3: 비밀번호 해싱 유틸리티 (bcrypt)

**Files:**
- Create: `backend/src/lib/password.ts`
- Test: `backend/tests/password.test.ts`

**Interfaces:**
- Produces: `hashPassword(password: string): Promise<string>`, `comparePassword(password: string, hash: string): Promise<boolean>`, `compareDummyPassword(password: string): Promise<void>` — auth.service.ts(Task 8)에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/password.test.ts` 생성:

```ts
import { describe, expect, it } from "vitest";
import { comparePassword, compareDummyPassword, hashPassword } from "@/lib/password";

describe("password", () => {
  it("hashes and verifies a matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");

    await expect(comparePassword("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects a non-matching password", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");

    await expect(comparePassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const hashA = await hashPassword("same-password");
    const hashB = await hashPassword("same-password");

    expect(hashA).not.toBe(hashB);
  });

  it("compareDummyPassword resolves without throwing regardless of input", async () => {
    await expect(compareDummyPassword("anything")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && pnpm test tests/password.test.ts`
Expected: FAIL — `@/lib/password` 모듈이 없음.

- [ ] **Step 3: 최소 구현 작성**

`backend/src/lib/password.ts` 생성:

```ts
import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

// bcrypt.hash("dummy-password-for-timing-safety", 10)로 미리 생성한 유효한 해시.
// 실제 어떤 계정과도 매칭되지 않으며, 계정이 없을 때도 compare 연산 시간을 맞추기 위해서만 사용한다.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8y0i1FQrxKAvyDzcRHENpQzR6Bqjh.";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function compareDummyPassword(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && pnpm test tests/password.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd backend
git add src/lib/password.ts tests/password.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: bcrypt 기반 비밀번호 해싱 유틸리티 추가

- 존재하지 않는 계정에 대한 타이밍 공격 방지용 compareDummyPassword 포함
EOF
)"
```

---

## Task 4: JWT 유틸리티 확장 (accessToken 15분 + sid, refreshToken 추가)

**Files:**
- Modify: `backend/src/lib/jwt.ts`
- Modify: `backend/tests/jwt.test.ts`
- Modify: `backend/tests/auth-middleware.test.ts`

**Interfaces:**
- Consumes: `getEnv().JWT_SECRET`, `getEnv().JWT_REFRESH_SECRET` (Task 1)
- Produces:
  - `interface AccessTokenPayload { sub: string; email: string; sid: string; type: "access" }`
  - `interface RefreshTokenPayload { sub: string; sid: string; type: "refresh" }`
  - `signAccessToken(payload: { sub: string; email: string; sid: string }): Promise<string>`
  - `verifyAccessToken(token: string): Promise<AccessTokenPayload>`
  - `signRefreshToken(payload: { sub: string; sid: string }): Promise<string>`
  - `verifyRefreshToken(token: string): Promise<RefreshTokenPayload>`
  - 이후 user.service.ts를 제외한 모든 auth 관련 Task(5~9)에서 사용.

- [ ] **Step 1: 실패하는 테스트로 jwt.test.ts 전체 교체**

`backend/tests/jwt.test.ts` 전체를 다음으로 교체:

```ts
import { describe, expect, it } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/jwt";

describe("access token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });
    const payload = await verifyAccessToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("user@example.com");
    expect(payload.sid).toBe("sid-1");
    expect(payload.type).toBe("access");
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });
    const tampered = `${token}tampered`;

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });

  it("rejects a refresh token presented as an access token", async () => {
    const refreshToken = await signRefreshToken({ sub: "user-1", sid: "sid-1" });

    await expect(verifyAccessToken(refreshToken)).rejects.toThrow();
  });

  it("produces a different token each time even with identical claims (jti uniqueness)", async () => {
    const tokenA = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });
    const tokenB = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });

    expect(tokenA).not.toBe(tokenB);
  });
});

describe("refresh token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signRefreshToken({ sub: "user-1", sid: "sid-1" });
    const payload = await verifyRefreshToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.sid).toBe("sid-1");
    expect(payload.type).toBe("refresh");
  });

  it("rejects a tampered token", async () => {
    const token = await signRefreshToken({ sub: "user-1", sid: "sid-1" });
    const tampered = `${token}tampered`;

    await expect(verifyRefreshToken(tampered)).rejects.toThrow();
  });

  it("rejects an access token presented as a refresh token", async () => {
    const accessToken = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });

    await expect(verifyRefreshToken(accessToken)).rejects.toThrow();
  });

  it("produces a different token each time even with identical claims (jti uniqueness)", async () => {
    const tokenA = await signRefreshToken({ sub: "user-1", sid: "sid-1" });
    const tokenB = await signRefreshToken({ sub: "user-1", sid: "sid-1" });

    expect(tokenA).not.toBe(tokenB);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && pnpm test tests/jwt.test.ts`
Expected: FAIL — `signRefreshToken`/`verifyRefreshToken`이 없고, `signAccessToken`이 `sid` 파라미터를 받지 않음. (jti 관련 두 테스트는 이 시점엔 컴파일 자체가 안 되어 실행되지 않는다 — Step 4에서 jti를 뺀 채로 구현하면 그 두 테스트가 별도로 flaky하게 실패할 수 있으니 반드시 Step 3에서 jti를 포함해서 구현한다.)

- [ ] **Step 3: jwt.ts 전체 재작성**

`backend/src/lib/jwt.ts` 전체를 다음으로 교체:

```ts
import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sid: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: "refresh";
}

function getAccessSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

function getRefreshSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_REFRESH_SECRET);
}

export async function signAccessToken(payload: {
  sub: string;
  email: string;
  sid: string;
}): Promise<string> {
  return new SignJWT({ email: payload.email, sid: payload.sid, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getAccessSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecretKey());

  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.sid !== "string" ||
    payload.type !== "access"
  ) {
    throw new Error("Invalid access token payload");
  }

  return { sub: payload.sub, email: payload.email, sid: payload.sid, type: "access" };
}

export async function signRefreshToken(payload: { sub: string; sid: string }): Promise<string> {
  return new SignJWT({ sid: payload.sid, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(getRefreshSecretKey());
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getRefreshSecretKey());

  if (typeof payload.sub !== "string" || typeof payload.sid !== "string" || payload.type !== "refresh") {
    throw new Error("Invalid refresh token payload");
  }

  return { sub: payload.sub, sid: payload.sid, type: "refresh" };
}
```

- [ ] **Step 4: jwt.test.ts 통과 확인**

Run: `cd backend && pnpm test tests/jwt.test.ts`
Expected: PASS

- [ ] **Step 5: auth-middleware.test.ts를 새 signAccessToken 시그니처에 맞게 수정**

`backend/tests/auth-middleware.test.ts`에서 `signAccessToken({ sub: "user-1", email: "user@example.com" })` 호출을 다음으로 교체:

```ts
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com", sid: "sid-1" });
```

- [ ] **Step 6: 전체 테스트 재확인**

Run: `cd backend && pnpm test`
Expected: PASS (jwt.test.ts, auth-middleware.test.ts 모두 통과)

- [ ] **Step 7: 커밋**

```bash
cd backend
git add src/lib/jwt.ts tests/jwt.test.ts tests/auth-middleware.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: refreshToken 발급/검증 추가 및 accessToken 만료를 15분으로 단축

- access/refresh 토큰 payload에 sid, type claim을 추가해 서로 오용되지 않도록 함
- refreshToken은 JWT_REFRESH_SECRET으로 별도 서명
- 모든 토큰에 jti(랜덤 UUID)를 추가해 동일 payload가 같은 초에 서명돼도 토큰이 겹치지 않도록 함
EOF
)"
```

---

## Task 5: 유저 조회 서비스

**Files:**
- Create: `backend/src/services/user.service.ts`
- Test: `backend/tests/user-service.test.ts`

**Interfaces:**
- Consumes: `db` from `@/db/client`, `users` schema from `@/db/schema`
- Produces: `getUserByEmail(email: string): Promise<{ id: string; name: string; email: string; passwordHash: string; createdAt: Date } | undefined>`, `getUserById(id: string): Promise<(같은 타입) | undefined>` — auth.service.ts(Task 8)에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/user-service.test.ts` 생성:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getUserByEmail, getUserById } from "@/services/user.service";

vi.mock("@/db/client", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return { ...actual, eq: vi.fn(actual.eq) };
});

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "user@example.com",
  passwordHash: "hashed-value",
  createdAt: new Date(),
};

describe("getUserByEmail", () => {
  beforeEach(() => {
    vi.mocked(db.query.users.findFirst).mockReset();
    vi.mocked(eq).mockClear();
  });

  it("normalizes email to lowercase before querying", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);

    const result = await getUserByEmail("User@Example.com");

    expect(result?.id).toBe("user-1");
    expect(eq).toHaveBeenCalledWith(users.email, "user@example.com");
  });

  it("returns undefined when the user is not found", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

    const result = await getUserByEmail("missing@example.com");

    expect(result).toBeUndefined();
  });
});

describe("getUserById", () => {
  beforeEach(() => {
    vi.mocked(db.query.users.findFirst).mockReset();
    vi.mocked(eq).mockClear();
  });

  it("queries by id", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(mockUser);

    const result = await getUserById("user-1");

    expect(result?.email).toBe("user@example.com");
    expect(eq).toHaveBeenCalledWith(users.id, "user-1");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && pnpm test tests/user-service.test.ts`
Expected: FAIL — `@/services/user.service` 모듈이 없음.

- [ ] **Step 3: user.service.ts 구현**

`backend/src/services/user.service.ts` 생성:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });
}

export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && pnpm test tests/user-service.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd backend
git add src/services/user.service.ts tests/user-service.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: 이메일/id 기준 유저 조회 서비스 추가

- 로그인 조회 시 이메일을 lowercase로 정규화
EOF
)"
```

---

## Task 6: Valkey 리프레시 세션 서비스

**Files:**
- Create: `backend/src/services/session.service.ts`
- Test: `backend/tests/session-service.test.ts`

**Interfaces:**
- Consumes: `valkey` from `@/cache/valkey`
- Produces: `saveRefreshSession(userId: string, sid: string, refreshToken: string): Promise<void>`, `rotateRefreshSession(userId: string, sid: string, oldRefreshToken: string, newRefreshToken: string): Promise<boolean>`, `deleteRefreshSession(userId: string, sid: string): Promise<void>` — auth.service.ts(Task 8)에서 사용.

`rotateRefreshSession`은 단순 GET-then-SET이 아니라 Valkey `EVAL`로 "저장된 해시가 예상한 old 해시와 같을 때만 new 해시로 교체"를 원자적으로 수행한다. 동시에 두 번 refresh 요청이 들어와도 하나만 성공하고, refresh와 logout이 경합해도 logout 이후에 refresh가 세션을 되살리는 일이 없다. 반환값이 `false`면(=제시된 토큰이 현재 저장된 해시와 다름, 즉 이미 회전되었거나 존재하지 않는 세션) 호출자(auth.service.ts)가 그 세션을 완전히 삭제해 reuse-detection을 수행한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/session-service.test.ts` 생성:

```ts
import { createHash } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { valkey } from "@/cache/valkey";
import {
  deleteRefreshSession,
  rotateRefreshSession,
  saveRefreshSession,
} from "@/services/session.service";

vi.mock("@/cache/valkey", () => ({
  valkey: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  },
}));

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("session service", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.mocked(valkey.set).mockReset();
    vi.mocked(valkey.get).mockReset();
    vi.mocked(valkey.del).mockReset();
    vi.mocked(valkey.eval).mockReset();

    vi.mocked(valkey.set).mockImplementation((async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }) as typeof valkey.set);

    vi.mocked(valkey.get).mockImplementation((async (key: string) => store.get(key) ?? null) as typeof valkey.get);

    vi.mocked(valkey.del).mockImplementation((async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }) as typeof valkey.del);

    // 실제 Valkey Lua 엔진 없이 CAS 스크립트의 동작을 in-memory Map으로 재현한다.
    vi.mocked(valkey.eval).mockImplementation((async (
      _script: string,
      _numKeys: number,
      key: string,
      expectedHash: string,
      newHash: string,
    ) => {
      if (store.get(key) !== expectedHash) {
        return 0;
      }
      store.set(key, newHash);
      return 1;
    }) as typeof valkey.eval);
  });

  it("saves a hashed refresh token under refresh:{userId}:{sid} with a 2-week TTL", async () => {
    await saveRefreshSession("user-1", "sid-1", "refresh-token-value");

    expect(valkey.set).toHaveBeenCalledWith(
      "refresh:user-1:sid-1",
      sha256("refresh-token-value"),
      "EX",
      60 * 60 * 24 * 14,
    );
  });

  it("rotates when the presented token matches the currently stored hash", async () => {
    await saveRefreshSession("user-1", "sid-1", "old-refresh-token");

    const rotated = await rotateRefreshSession(
      "user-1",
      "sid-1",
      "old-refresh-token",
      "new-refresh-token",
    );

    expect(rotated).toBe(true);
    expect(store.get("refresh:user-1:sid-1")).toBe(sha256("new-refresh-token"));
  });

  it("fails to rotate when the presented token no longer matches (already rotated/stale)", async () => {
    await saveRefreshSession("user-1", "sid-1", "old-refresh-token");
    await rotateRefreshSession("user-1", "sid-1", "old-refresh-token", "new-refresh-token");

    const staleRotation = await rotateRefreshSession(
      "user-1",
      "sid-1",
      "old-refresh-token",
      "yet-another-token",
    );

    expect(staleRotation).toBe(false);
    expect(store.get("refresh:user-1:sid-1")).toBe(sha256("new-refresh-token"));
  });

  it("fails to rotate when no session exists", async () => {
    const rotated = await rotateRefreshSession("user-1", "sid-1", "any-token", "new-refresh-token");

    expect(rotated).toBe(false);
  });

  it("keeps sessions for different sids independent", async () => {
    await saveRefreshSession("user-1", "sid-1", "device-a-token");
    await saveRefreshSession("user-1", "sid-2", "device-b-token");

    const rotatedA = await rotateRefreshSession("user-1", "sid-1", "device-a-token", "device-a-token-2");

    expect(rotatedA).toBe(true);
    expect(store.get("refresh:user-1:sid-2")).toBe(sha256("device-b-token"));
  });

  it("deletes a session by userId and sid", async () => {
    await saveRefreshSession("user-1", "sid-1", "refresh-token-value");

    await deleteRefreshSession("user-1", "sid-1");

    expect(valkey.del).toHaveBeenCalledWith("refresh:user-1:sid-1");
    expect(store.has("refresh:user-1:sid-1")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && pnpm test tests/session-service.test.ts`
Expected: FAIL — `@/services/session.service` 모듈이 없음.

- [ ] **Step 3: session.service.ts 구현**

`backend/src/services/session.service.ts` 생성:

```ts
import { createHash } from "node:crypto";
import { valkey } from "@/cache/valkey";

const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 14;

// KEYS[1] = 세션 키, ARGV[1] = 기대하는 이전 해시, ARGV[2] = 새 해시, ARGV[3] = TTL(초)
// 저장된 값이 기대한 이전 해시와 같을 때만 새 해시로 교체한다 (compare-and-set).
const ROTATE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  redis.call("SET", KEYS[1], ARGV[2], "EX", ARGV[3])
  return 1
else
  return 0
end
`;

function sessionKey(userId: string, sid: string): string {
  return `refresh:${userId}:${sid}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function saveRefreshSession(
  userId: string,
  sid: string,
  refreshToken: string,
): Promise<void> {
  await valkey.set(
    sessionKey(userId, sid),
    hashToken(refreshToken),
    "EX",
    REFRESH_TOKEN_TTL_SECONDS,
  );
}

export async function rotateRefreshSession(
  userId: string,
  sid: string,
  oldRefreshToken: string,
  newRefreshToken: string,
): Promise<boolean> {
  const result = await valkey.eval(
    ROTATE_SCRIPT,
    1,
    sessionKey(userId, sid),
    hashToken(oldRefreshToken),
    hashToken(newRefreshToken),
    REFRESH_TOKEN_TTL_SECONDS,
  );
  return result === 1;
}

export async function deleteRefreshSession(userId: string, sid: string): Promise<void> {
  await valkey.del(sessionKey(userId, sid));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && pnpm test tests/session-service.test.ts`
Expected: PASS. `valkey.eval`의 반환 타입이 `unknown`으로 잡혀 `result === 1` 비교에서 타입 에러가 나면, `const result = await valkey.eval(...) as number;`로 캐스팅한다.

- [ ] **Step 5: 커밋**

```bash
cd backend
git add src/services/session.service.ts tests/session-service.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: Valkey 기반 리프레시 세션 저장/원자적 회전/삭제 서비스 추가

- 키를 refresh:{userId}:{sid}로 두어 기기별 멀티 세션을 지원
- refreshToken 원문 대신 sha256 해시를 저장
- 회전은 Lua EVAL 기반 compare-and-set으로 원자적으로 수행해 동시 refresh/logout 경합을 방지
EOF
)"
```

---

## Task 7: 로그인 요청 검증 스키마

**Files:**
- Create: `backend/src/schemas/auth.schema.ts`
- Test: `backend/tests/auth-schema.test.ts`

**Interfaces:**
- Produces: `loginSchema: ZodObject<{ email: ZodString; password: ZodString }>`, `type LoginInput = { email: string; password: string }` — auth.controller.ts(Task 9)에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/auth-schema.test.ts` 생성:

```ts
import { describe, expect, it } from "vitest";
import { loginSchema } from "@/schemas/auth.schema";

describe("loginSchema", () => {
  it("accepts a valid email/password payload", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "secret123" });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret123" });

    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });

    expect(result.success).toBe(false);
  });

  it("rejects a missing password field", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" });

    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && pnpm test tests/auth-schema.test.ts`
Expected: FAIL — `@/schemas/auth.schema` 모듈이 없음.

- [ ] **Step 3: auth.schema.ts 구현**

`backend/src/schemas/auth.schema.ts` 생성:

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "email is required").email("invalid email"),
  password: z.string().min(1, "password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && pnpm test tests/auth-schema.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd backend
git add src/schemas/auth.schema.ts tests/auth-schema.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: 로그인 요청 body zod 검증 스키마 추가
EOF
)"
```

---

## Task 8: 인증 비즈니스 로직 (auth.service.ts)

**Files:**
- Create: `backend/src/services/auth.service.ts`
- Test: `backend/tests/auth-service.test.ts`

**Interfaces:**
- Consumes:
  - `hashPassword`, `comparePassword`, `compareDummyPassword` from `@/lib/password` (Task 3)
  - `signAccessToken`, `signRefreshToken`, `verifyRefreshToken` from `@/lib/jwt` (Task 4)
  - `getUserByEmail`, `getUserById` from `@/services/user.service` (Task 5)
  - `saveRefreshSession`, `rotateRefreshSession`, `deleteRefreshSession` from `@/services/session.service` (Task 6)
  - `HttpError` from `@/utils/http-error` (Task 2)
- Produces:
  - `login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string } }>`
  - `refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string } }>`
  - `logout(userId: string, sid: string): Promise<void>`
  - 위 3개 함수 모두 auth.controller.ts(Task 9)에서 사용.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/tests/auth-service.test.ts` 생성:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as passwordLib from "@/lib/password";
import * as jwtLib from "@/lib/jwt";
import * as userService from "@/services/user.service";
import * as sessionService from "@/services/session.service";
import { login, logout, refresh } from "@/services/auth.service";

vi.mock("@/lib/password");
vi.mock("@/lib/jwt");
vi.mock("@/services/user.service");
vi.mock("@/services/session.service");

const mockUser = {
  id: "user-1",
  name: "Test User",
  email: "user@example.com",
  passwordHash: "hashed-value",
  createdAt: new Date(),
};

describe("auth.service login", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws INVALID_CREDENTIALS and runs the dummy compare when the account does not exist", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(undefined);
    vi.mocked(passwordLib.compareDummyPassword).mockResolvedValue(undefined);

    await expect(login("missing@example.com", "any-password")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
    expect(passwordLib.compareDummyPassword).toHaveBeenCalledWith("any-password");
  });

  it("throws INVALID_CREDENTIALS when the password does not match", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(mockUser);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(false);

    await expect(login("user@example.com", "wrong")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
    });
  });

  it("issues tokens and saves a session on success", async () => {
    vi.mocked(userService.getUserByEmail).mockResolvedValue(mockUser);
    vi.mocked(passwordLib.comparePassword).mockResolvedValue(true);
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("access-token");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("refresh-token");
    vi.mocked(sessionService.saveRefreshSession).mockResolvedValue(undefined);

    const result = await login("user@example.com", "correct");

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.user).toEqual({ id: "user-1", name: "Test User", email: "user@example.com" });
    expect(sessionService.saveRefreshSession).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
      "refresh-token",
    );
  });
});

describe("auth.service refresh", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws INVALID_REFRESH_TOKEN when verification fails", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockRejectedValue(new Error("bad token"));

    await expect(refresh("bad-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("throws INVALID_REFRESH_TOKEN when the user no longer exists", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
      sub: "user-1",
      sid: "sid-1",
      type: "refresh",
    });
    vi.mocked(userService.getUserById).mockResolvedValue(undefined);

    await expect(refresh("some-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("deletes the session and throws INVALID_REFRESH_TOKEN when rotation fails (stale/reused token)", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
      sub: "user-1",
      sid: "sid-1",
      type: "refresh",
    });
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("new-access-token");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("new-refresh-token");
    vi.mocked(sessionService.rotateRefreshSession).mockResolvedValue(false);
    vi.mocked(sessionService.deleteRefreshSession).mockResolvedValue(undefined);

    await expect(refresh("stale-token")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
    expect(sessionService.deleteRefreshSession).toHaveBeenCalledWith("user-1", "sid-1");
  });

  it("rotates both tokens atomically on success", async () => {
    vi.mocked(jwtLib.verifyRefreshToken).mockResolvedValue({
      sub: "user-1",
      sid: "sid-1",
      type: "refresh",
    });
    vi.mocked(userService.getUserById).mockResolvedValue(mockUser);
    vi.mocked(jwtLib.signAccessToken).mockResolvedValue("new-access-token");
    vi.mocked(jwtLib.signRefreshToken).mockResolvedValue("new-refresh-token");
    vi.mocked(sessionService.rotateRefreshSession).mockResolvedValue(true);

    const result = await refresh("valid-refresh-token");

    expect(result).toEqual({ accessToken: "new-access-token", refreshToken: "new-refresh-token" });
    expect(sessionService.rotateRefreshSession).toHaveBeenCalledWith(
      "user-1",
      "sid-1",
      "valid-refresh-token",
      "new-refresh-token",
    );
    expect(sessionService.deleteRefreshSession).not.toHaveBeenCalled();
  });
});

describe("auth.service logout", () => {
  it("deletes the refresh session for the given user and session id", async () => {
    vi.mocked(sessionService.deleteRefreshSession).mockResolvedValue(undefined);

    await logout("user-1", "sid-1");

    expect(sessionService.deleteRefreshSession).toHaveBeenCalledWith("user-1", "sid-1");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && pnpm test tests/auth-service.test.ts`
Expected: FAIL — `@/services/auth.service` 모듈이 없음.

- [ ] **Step 3: auth.service.ts 구현**

`backend/src/services/auth.service.ts` 생성:

```ts
import { randomUUID } from "node:crypto";
import { compareDummyPassword, comparePassword } from "@/lib/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/jwt";
import { getUserByEmail, getUserById } from "@/services/user.service";
import {
  deleteRefreshSession,
  rotateRefreshSession,
  saveRefreshSession,
} from "@/services/session.service";
import { HttpError } from "@/utils/http-error";

const INVALID_CREDENTIALS_MESSAGE = "이메일 또는 비밀번호가 올바르지 않습니다";
const INVALID_REFRESH_TOKEN_MESSAGE = "로그인이 만료되었습니다. 다시 로그인해주세요";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends AuthTokens {
  user: { id: string; name: string; email: string };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await getUserByEmail(email);

  if (!user) {
    await compareDummyPassword(password);
    throw new HttpError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);
  if (!passwordMatches) {
    throw new HttpError(401, "INVALID_CREDENTIALS", INVALID_CREDENTIALS_MESSAGE);
  }

  const sid = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email, sid }),
    signRefreshToken({ sub: user.id, sid }),
  ]);

  await saveRefreshSession(user.id, sid, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, name: user.name, email: user.email },
  };
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  let payload;
  try {
    payload = await verifyRefreshToken(refreshToken);
  } catch {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", INVALID_REFRESH_TOKEN_MESSAGE);
  }

  const user = await getUserById(payload.sub);
  if (!user) {
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", INVALID_REFRESH_TOKEN_MESSAGE);
  }

  const [accessToken, newRefreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, email: user.email, sid: payload.sid }),
    signRefreshToken({ sub: user.id, sid: payload.sid }),
  ]);

  const rotated = await rotateRefreshSession(user.id, payload.sid, refreshToken, newRefreshToken);
  if (!rotated) {
    // 제시된 토큰이 이미 회전되어 폐기됐거나 세션이 존재하지 않음 — 재사용(탈취) 신호로 보고
    // 이 sid의 세션을 완전히 폐기한다(reuse detection). 프론트엔드는 이 401을 자동 재시도하면
    // 안 되고 재로그인으로 유도해야 한다 — 그렇지 않으면 정상적인 재시도조차 세션을 죽인다.
    await deleteRefreshSession(user.id, payload.sid);
    throw new HttpError(401, "INVALID_REFRESH_TOKEN", INVALID_REFRESH_TOKEN_MESSAGE);
  }

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string, sid: string): Promise<void> {
  await deleteRefreshSession(userId, sid);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && pnpm test tests/auth-service.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd backend
git add src/services/auth.service.ts tests/auth-service.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: login/refresh/logout 비즈니스 로직 추가

- 계정 없음/비밀번호 불일치를 동일한 401 INVALID_CREDENTIALS로 응답
- refresh는 같은 sid를 유지하며 accessToken/refreshToken을 원자적으로 회전
- 회전 실패(이미 폐기된 토큰 재사용) 시 해당 세션을 완전히 삭제하는 reuse detection 포함
EOF
)"
```

---

## Task 9: 컨트롤러 (요청/응답 + 쿠키 처리)

**Files:**
- Create: `backend/src/controllers/auth.controller.ts`

**Interfaces:**
- Consumes: `loginSchema` (Task 7), `login`/`refresh`/`logout` (Task 8), `HttpError` (Task 2), `getEnv()` (Task 1), `req.user: AccessTokenPayload` (기존 `authenticate` 미들웨어가 주입)
- Produces: `loginHandler`, `refreshHandler`, `logoutHandler` (모두 `(req: Request, res: Response) => Promise<void>`) — auth.routes.ts(Task 10)에서 사용.

이 Task는 순수 HTTP 어댑터라 별도 유닛 테스트 없이 Task 12의 통합 테스트로 검증한다(라우트에 연결된 상태에서만 의미 있게 테스트 가능).

- [ ] **Step 1: auth.controller.ts 구현**

`backend/src/controllers/auth.controller.ts` 생성:

```ts
import type { Request, Response } from "express";
import { getEnv } from "@/config/env";
import { loginSchema } from "@/schemas/auth.schema";
import { login, logout, refresh } from "@/services/auth.service";
import { HttpError } from "@/utils/http-error";

const REFRESH_TOKEN_COOKIE = "refreshToken";
const REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function refreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/auth/refresh",
  };
}

function setRefreshTokenCookie(res: Response, token: string) {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...refreshTokenCookieOptions(),
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  });
}

function clearRefreshTokenCookie(res: Response) {
  res.clearCookie(REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions());
}

export async function loginHandler(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid request body",
    );
  }

  const result = await login(parsed.data.email, parsed.data.password);

  setRefreshTokenCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
}

export async function refreshHandler(req: Request, res: Response) {
  // 쿠키는 브라우저가 자동으로 첨부하므로 CSRF 방어선을 하나 더 둔다: Origin 헤더가
  // 있는데 우리 CORS_ORIGIN과 다르면 거부한다. sameSite가 향후 cross-site 배포 때문에
  // "none"으로 바뀌더라도 이 검사가 남아있어 방어된다. Origin이 아예 없는 요청(서버 간
  // 호출 등)은 통과시킨다 — 그 경우는 애초에 쿠키가 전달되지 않으므로 위험이 없다.
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin !== getEnv().CORS_ORIGIN) {
    throw new HttpError(403, "INVALID_ORIGIN", "Invalid request origin");
  }

  const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof refreshToken !== "string") {
    throw new HttpError(
      401,
      "INVALID_REFRESH_TOKEN",
      "로그인이 만료되었습니다. 다시 로그인해주세요",
    );
  }

  const result = await refresh(refreshToken);

  setRefreshTokenCookie(res, result.refreshToken);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
}

export async function logoutHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new HttpError(401, "UNAUTHORIZED", "Missing bearer token");
  }

  await logout(req.user.sub, req.user.sid);

  clearRefreshTokenCookie(res);
  res.status(204).send();
}
```

- [ ] **Step 2: 타입 체크**

Run: `cd backend && pnpm build`
Expected: 컴파일 에러 없음 (아직 라우트에 연결되지 않았어도 타입은 독립적으로 검증 가능해야 한다). 만약 `req.user`, `req.cookies` 관련 타입 에러가 나면, `req.cookies`는 `cookie-parser`의 타입 정의(Task 1에서 설치한 `@types/cookie-parser`)가 `Express.Request`에 자동으로 병합되므로 `import` 없이도 인식되어야 한다 — 안 되면 이 파일에 `import "cookie-parser";` 한 줄을 최상단에 추가한다.

- [ ] **Step 3: 커밋**

```bash
cd backend
git add src/controllers/auth.controller.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: 로그인/refresh/logout 컨트롤러 추가

- refreshToken은 httpOnly 쿠키로, accessToken/user는 응답 body로 응답
- refresh는 Origin 헤더가 CORS_ORIGIN과 다르면 거부(CSRF 방어 심화)
EOF
)"
```

---

## Task 10: 라우트 연결

**Files:**
- Create: `backend/src/routes/auth.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: `loginHandler`, `refreshHandler`, `logoutHandler` (Task 9), `authenticate` from `@/middlewares/auth.middleware` (기존), `asyncHandler` from `@/utils/async-handler` (기존)
- Produces: `authRouter` (Express Router), `/auth` 경로에 마운트됨 — Task 12 통합 테스트와 app.ts(Task 11)에서 사용.

- [ ] **Step 1: auth.routes.ts 작성**

`backend/src/routes/auth.routes.ts` 생성:

```ts
import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";
import { loginHandler, logoutHandler, refreshHandler } from "@/controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(loginHandler));
authRouter.post("/refresh", asyncHandler(refreshHandler));
authRouter.post("/logout", authenticate, asyncHandler(logoutHandler));
```

- [ ] **Step 2: routes/index.ts에 마운트**

`backend/src/routes/index.ts` 전체를 다음으로 교체:

```ts
import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";
import { authRouter } from "@/routes/auth.routes";

export const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
```

- [ ] **Step 3: 기존 앱 테스트가 여전히 통과하는지 확인**

Run: `cd backend && pnpm test tests/app.test.ts`
Expected: PASS (여전히 알 수 없는 라우트는 404를 반환해야 한다)

- [ ] **Step 4: 커밋**

```bash
cd backend
git add src/routes/auth.routes.ts src/routes/index.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: /auth 라우트를 앱에 마운트
EOF
)"
```

---

## Task 11: app.ts — 쿠키 파싱, CORS, 로그 redact

**Files:**
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/app.test.ts`

**Interfaces:**
- Consumes: `getEnv().CORS_ORIGIN` (Task 1)
- Produces: `createApp()`이 이제 `cookie-parser`를 등록하고, credentials 허용 CORS와 헤더 redact 로깅을 포함함 — Task 12에서 실제 요청을 보낼 때 전제로 함.

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/tests/app.test.ts`에 아래 테스트를 추가 (기존 `describe` 블록 안, 기존 테스트 다음에):

```ts
  it("allows credentialed requests from the configured CORS origin", async () => {
    const response = await request(createApp())
      .options("/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && pnpm test tests/app.test.ts`
Expected: FAIL — 현재 `cors()`는 origin을 반사(reflect)하지 않고 `*`를 반환하며 `access-control-allow-credentials` 헤더가 없음.

- [ ] **Step 3: app.ts 수정**

`backend/src/app.ts` 전체를 다음으로 교체:

```ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { getEnv } from "@/config/env";
import { router } from "@/routes/index";
import { rateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { notFoundMiddleware } from "@/middlewares/not-found.middleware";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";
import { logger } from "@/utils/logger";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: getEnv().CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    }),
  );
  app.use(rateLimitMiddleware);

  app.use(router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && pnpm test tests/app.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 테스트 스위트 재확인**

Run: `cd backend && pnpm test`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd backend
git add src/app.ts tests/app.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: cookie-parser 등록, CORS를 credentials 허용으로 변경, 인증 헤더 로그 redact 추가
EOF
)"
```

---

## Task 12: 통합 테스트 — 로그인/refresh/logout 전체 흐름

**Files:**
- Test: `backend/tests/auth.test.ts`

**Interfaces:**
- Consumes: `authRouter` (Task 10), `errorHandlerMiddleware` (Task 2), `hashPassword` (Task 3), `db`/`valkey` 모킹.

이 Task는 새 프로덕션 코드를 추가하지 않고, 지금까지 만든 모든 조각이 실제 HTTP 요청 흐름에서 올바르게 맞물리는지 supertest로 검증한다.

- [ ] **Step 1: 통합 테스트 작성**

`backend/tests/auth.test.ts` 생성:

```ts
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import type { Response as SupertestResponse } from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { db } from "@/db/client";
import { valkey } from "@/cache/valkey";
import { hashPassword } from "@/lib/password";
import { authRouter } from "@/routes/auth.routes";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";

vi.mock("@/db/client", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

vi.mock("@/cache/valkey", () => ({
  valkey: {
    set: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  },
}));

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/auth", authRouter);
  app.use(errorHandlerMiddleware);
  return app;
}

function extractCookie(response: SupertestResponse, name: string): string | undefined {
  const raw = response.headers["set-cookie"] as unknown as string[] | undefined;
  const cookie = raw?.find((c) => c.startsWith(`${name}=`));
  return cookie?.split(";")[0]?.split("=")[1];
}

function extractSetCookieHeader(response: SupertestResponse, name: string): string | undefined {
  const raw = response.headers["set-cookie"] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${name}=`));
}

// 실제 Valkey Lua 엔진 없이, session.service.ts의 ROTATE_SCRIPT가 하는
// compare-and-set 동작을 in-memory Map으로 재현해 valkey.set/get/del/eval을 연결한다.
// 여러 sid(기기) 간 세션이 서로 독립적인지도 이 store 하나로 검증할 수 있다.
function wireValkeyMock(store: Map<string, string>) {
  vi.mocked(valkey.set).mockImplementation((async (key: string, value: string) => {
    store.set(key, value);
    return "OK";
  }) as typeof valkey.set);

  vi.mocked(valkey.get).mockImplementation((async (key: string) => store.get(key) ?? null) as typeof valkey.get);

  vi.mocked(valkey.del).mockImplementation((async (key: string) => {
    const existed = store.delete(key);
    return existed ? 1 : 0;
  }) as typeof valkey.del);

  vi.mocked(valkey.eval).mockImplementation((async (
    _script: string,
    _numKeys: number,
    key: string,
    expectedHash: string,
    newHash: string,
  ) => {
    if (store.get(key) !== expectedHash) {
      return 0;
    }
    store.set(key, newHash);
    return 1;
  }) as typeof valkey.eval);
}

const seededUser = {
  id: "user-1",
  name: "Test User",
  email: "user@example.com",
  createdAt: new Date(),
};

describe("POST /auth/login", () => {
  beforeEach(() => {
    vi.mocked(db.query.users.findFirst).mockReset();
    vi.mocked(valkey.set).mockReset();
    vi.mocked(valkey.get).mockReset();
    vi.mocked(valkey.del).mockReset();
    vi.mocked(valkey.eval).mockReset();
  });

  it("returns 401 for a non-existent account", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined);

    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "missing@example.com", password: "whatever" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for a wrong password", async () => {
    const passwordHash = await hashPassword("correct-password");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });

    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "wrong-password" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 400 for an invalid request body", async () => {
    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "not-an-email", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns accessToken/user in the body and refreshToken only as a cookie", async () => {
    const passwordHash = await hashPassword("correct-password");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });
    wireValkeyMock(new Map());

    const response = await request(buildTestApp())
      .post("/auth/login")
      .send({ email: "user@example.com", password: "correct-password" });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toBeUndefined();
    expect(response.body.user).toEqual({ id: "user-1", name: "Test User", email: "user@example.com" });
    expect(extractCookie(response, "refreshToken")).toBeTruthy();

    const setCookieHeader = extractSetCookieHeader(response, "refreshToken");
    expect(setCookieHeader).toMatch(/HttpOnly/i);
    expect(setCookieHeader).toMatch(/SameSite=Lax/i);
    expect(setCookieHeader).toMatch(/Path=\/auth\/refresh/i);
    expect(setCookieHeader).toMatch(/Max-Age=\d+/i);
    // NODE_ENV=test이므로 secure:false로 서명된다 — Secure 속성이 없어야 한다.
    expect(setCookieHeader).not.toMatch(/;\s*Secure/i);
  });

  it("keeps two devices logged in independently (multi-session)", async () => {
    const passwordHash = await hashPassword("correct-password");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });
    wireValkeyMock(new Map());
    const app = buildTestApp();

    const deviceALogin = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "correct-password" });
    const deviceBLogin = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "correct-password" });

    const deviceACookie = extractCookie(deviceALogin, "refreshToken") as string;
    const deviceBCookie = extractCookie(deviceBLogin, "refreshToken") as string;
    expect(deviceACookie).not.toBe(deviceBCookie);

    const deviceARefresh = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${deviceACookie}`]);
    expect(deviceARefresh.status).toBe(200);

    // A 기기가 회전해도 B 기기의 기존 세션은 여전히 살아있어야 한다.
    const deviceBRefresh = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${deviceBCookie}`]);
    expect(deviceBRefresh.status).toBe(200);
  });
});

describe("POST /auth/refresh and /auth/logout", () => {
  beforeEach(() => {
    vi.mocked(db.query.users.findFirst).mockReset();
    vi.mocked(valkey.set).mockReset();
    vi.mocked(valkey.get).mockReset();
    vi.mocked(valkey.del).mockReset();
    vi.mocked(valkey.eval).mockReset();
  });

  async function loginAndGetApp() {
    const passwordHash = await hashPassword("correct-password");
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ ...seededUser, passwordHash });
    wireValkeyMock(new Map());

    const app = buildTestApp();
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({ email: "user@example.com", password: "correct-password" });

    return {
      app,
      accessToken: loginResponse.body.accessToken as string,
      refreshCookie: extractCookie(loginResponse, "refreshToken") as string,
    };
  }

  it("returns 401 when no refreshToken cookie is sent", async () => {
    const response = await request(buildTestApp()).post("/auth/refresh");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("rotates tokens on refresh and rejects the old refreshToken afterwards", async () => {
    const { app, refreshCookie } = await loginAndGetApp();

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    const rotatedCookie = extractCookie(refreshResponse, "refreshToken");
    expect(rotatedCookie).toBeTruthy();
    expect(rotatedCookie).not.toBe(refreshCookie);

    const staleResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);

    expect(staleResponse.status).toBe(401);
    expect(staleResponse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
  });

  it("replaying an already-rotated refreshToken kills the whole session (reuse detection)", async () => {
    const { app, refreshCookie } = await loginAndGetApp();

    const refreshResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);
    const rotatedCookie = extractCookie(refreshResponse, "refreshToken") as string;

    // 이미 회전되어 폐기된 최초 refreshToken을 다시 제시한다(탈취/재시도 시나리오).
    const replayResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);
    expect(replayResponse.status).toBe(401);

    // 방금 정상적으로 회전되어 유효했던 토큰까지도 세션 전체 폐기로 함께 무효화된다.
    const rotatedTokenResponse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${rotatedCookie}`]);
    expect(rotatedTokenResponse.status).toBe(401);
  });

  it("rejects refresh when the Origin header does not match CORS_ORIGIN", async () => {
    const { app, refreshCookie } = await loginAndGetApp();

    const response = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`])
      .set("Origin", "http://evil.example.com");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("INVALID_ORIGIN");
  });

  it("logs out and invalidates the session so refresh fails afterwards", async () => {
    const { app, accessToken, refreshCookie } = await loginAndGetApp();

    const logoutResponse = await request(app)
      .post("/auth/logout")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logoutResponse.status).toBe(204);

    const refreshAfterLogout = await request(app)
      .post("/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);

    expect(refreshAfterLogout.status).toBe(401);
  });

  it("returns 401 from logout without a bearer token", async () => {
    const response = await request(buildTestApp()).post("/auth/logout");

    expect(response.status).toBe(401);
  });
});
```

- [ ] **Step 2: 테스트 실행 및 통과 확인**

Run: `cd backend && pnpm test tests/auth.test.ts`
Expected: PASS. 만약 실패한다면 우선순위대로 원인을 확인한다 — (a) 이전 Task들의 mock 인터페이스가 실제 구현과 어긋났는지(특히 `rotateRefreshSession`/`valkey.eval` 시그니처), (b) 쿠키 `path: "/auth/refresh"` 설정 때문에 supertest 요청에 쿠키가 자동으로 실리지 않아 수동으로 `Cookie` 헤더를 세팅해야 하는지(이 테스트는 이미 수동 세팅함), (c) `wireValkeyMock`이 매 테스트마다 새 `Map`으로 다시 연결되어 있는지(이전 테스트의 세션이 남아있으면 멀티세션/재사용 감지 테스트가 오염된다).

- [ ] **Step 3: 전체 테스트 스위트 최종 확인**

Run: `cd backend && pnpm test`
Expected: 전체 PASS

- [ ] **Step 4: lint 확인**

Run: `cd backend && pnpm lint`
Expected: 에러 없음 (경고가 있다면 수정)

- [ ] **Step 5: 커밋**

```bash
cd backend
git add tests/auth.test.ts
git commit -m "$(cat <<'EOF'
#{issue}/feature: 로그인/refresh/logout 통합 테스트 추가

- 계정 없음/비밀번호 오류/토큰 회전/로그아웃 후 refresh 실패 흐름을 supertest로 검증
- 멀티 세션 독립성, 재사용된 stale 토큰의 세션 전체 폐기, 쿠키 보안 속성, Origin 검증도 함께 검증
EOF
)"
```

---

## 완료 후 최종 점검

- [ ] `cd backend && pnpm install && pnpm lint && pnpm test && pnpm build` 모두 통과
- [ ] `docs/superpowers/specs/2026-09-06-login-feature-design.md`의 완료 기준(§9) 전 항목이 테스트로 커버되는지 재확인
- [ ] `.env.example`에 `JWT_REFRESH_SECRET`, `CORS_ORIGIN`이 추가되어 있는지 확인
