# Backend Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `backend/` 디렉터리에 Express + TypeScript + MVC 패턴 기반 백엔드 프로젝트의 기술 기반(스캐폴딩)을 구성한다. 실제 도메인 기능(로그인, Workspace/Project/Whiteboard Document CRUD)은 구현하지 않는다.

**Architecture:** routes → controllers → services 계층으로 HTTP 요청을 처리하는 classic MVC. DB(PostgreSQL/Drizzle)와 캐시(Valkey)는 지연 연결(lazy connect) 클라이언트로 준비만 해두고, `GET /health` 하나로 전체 계층 연결이 동작함을 검증한다.

**Tech Stack:** Express, TypeScript(ESM), Drizzle ORM + drizzle-kit + drizzle-zod, PostgreSQL(postgres.js), Valkey(iovalkey), jose, zod, pino/pino-http/pino-pretty, vitest + supertest, pnpm, husky + lint-staged.

**Spec:** `docs/superpowers/specs/2026-09-05-backend-scaffolding-design.md`

## Global Constraints

- 패키지 매니저는 pnpm을 사용한다.
- `backend/package.json`에 `"type": "module"`을 지정해 ESM으로 구성한다.
- MVC 계층 분리를 지킨다: routes(URL 매핑) → controllers(요청/응답 변환) → services(비즈니스 로직) → db/schema(모델).
- 경로 alias `@/*` → `src/*`를 tsconfig `paths`로 설정하고, 프로덕션 빌드는 `tsc-alias`로 alias를 상대경로로 재작성한다.
- DB는 PostgreSQL + drizzle-orm/drizzle-kit, 캐시는 Valkey(iovalkey)를 사용하며 둘 다 모듈 로드 시점에 연결을 강제하지 않는 지연 연결 방식으로 구성한다.
- 인증은 jose로 JWT 서명/검증 헬퍼와 미들웨어 스켈레톤만 준비한다. 로그인 API(비밀번호 검증, 토큰 발급) 자체는 이번 범위 밖이다(Non-Goal).
- Workspace/Project/Whiteboard Document CRUD, 실시간 협업(WebSocket) 계층은 이번 범위 밖이다(Non-Goal).
- 실제 PostgreSQL/Valkey 인스턴스 없이도 `pnpm dev`/`pnpm build && pnpm start`/`pnpm test`가 모두 성공해야 한다.

---

## File Structure

```
backend/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── drizzle.config.ts
├── eslint.config.js
├── .prettierrc
├── .lintstagedrc.json
├── .gitignore
├── .env.example
├── README.md
├── .husky/
│   └── pre-commit
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   └── env.ts
│   ├── db/
│   │   ├── client.ts
│   │   └── schema/
│   │       ├── users.ts
│   │       ├── workspaces.ts
│   │       ├── workspace-memberships.ts
│   │       ├── projects.ts
│   │       ├── whiteboard-documents.ts
│   │       ├── relations.ts
│   │       └── index.ts
│   ├── cache/
│   │   └── valkey.ts
│   ├── routes/
│   │   ├── index.ts
│   │   └── health.routes.ts
│   ├── controllers/
│   │   └── health.controller.ts
│   ├── services/
│   │   └── health.service.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── error-handler.middleware.ts
│   │   └── not-found.middleware.ts
│   ├── lib/
│   │   └── jwt.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── async-handler.ts
│   └── types/
│       └── express.d.ts
└── tests/
    ├── env.test.ts
    ├── middlewares.test.ts
    ├── app.test.ts
    ├── health.test.ts
    ├── db-schema.test.ts
    ├── db-client.test.ts
    ├── valkey-client.test.ts
    ├── jwt.test.ts
    └── auth-middleware.test.ts
```

---

### Task 1: 프로젝트 초기화 및 개발 도구 설정

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/eslint.config.js`
- Create: `backend/.prettierrc`
- Create: `backend/.gitignore`
- Create: `backend/.env.example`

**Interfaces:**
- Consumes: 없음 (최초 작업)
- Produces: 이후 모든 태스크가 사용할 `pnpm dev/build/start/lint/test/db:*` 스크립트, `@/*` 경로 alias, ESM 모듈 환경

- [ ] **Step 1: backend 폴더 생성 및 pnpm 프로젝트 초기화**

```bash
mkdir -p backend
cd backend
pnpm init
```

- [ ] **Step 2: 런타임 의존성 설치**

```bash
pnpm add express@^4 cors helmet compression express-rate-limit drizzle-orm drizzle-zod postgres iovalkey jose zod dotenv pino pino-http
```

- [ ] **Step 3: 개발 의존성 설치**

```bash
pnpm add -D typescript tsx tsc-alias rimraf drizzle-kit pino-pretty eslint @eslint/js typescript-eslint eslint-config-prettier eslint-plugin-import eslint-import-resolver-typescript prettier husky lint-staged vitest supertest @types/node @types/express@^4 @types/cors @types/compression @types/supertest
```

- [ ] **Step 4: package.json에 type/engines/scripts 추가**

`pnpm add`가 만들어둔 `dependencies`/`devDependencies`는 그대로 두고, 아래 필드를 `package.json`에 병합한다(최상위에 `type`, `engines` 추가, `scripts`는 `pnpm init`이 만든 기본값을 아래 내용으로 교체):

```json
{
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "prebuild": "rimraf dist",
    "build": "tsc && tsc-alias --resolve-full-paths",
    "start": "node dist/server.js",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "prepare": "cd .. && husky backend/.husky"
  }
}
```

`prepare`가 `cd .. && husky backend/.husky`인 이유: `backend/`는 저장소 루트가 아닌 하위 폴더라, husky가 cwd 기준으로 `.git` 존재를 확인하는 방식상 저장소 루트로 이동한 뒤 훅 디렉터리 경로(`backend/.husky`)를 인자로 넘겨야 한다.

`build`에 `--resolve-full-paths`가 필요한 이유: `tsc-alias`는 `@/*` alias를 상대경로로만 바꿔줄 뿐 확장자를 붙여주지 않는다. `package.json`이 `"type": "module"`이라 Node ESM 런타임은 상대 import에 명시적 확장자(`.js`)가 없으면 `ERR_MODULE_NOT_FOUND`로 실패하므로, 이 플래그로 재작성된 경로에 `.js`를 강제로 붙인다.

- [ ] **Step 5: tsconfig.json 작성**

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*.ts"]
}
```

`moduleResolution`을 `"bundler"`로 설정하는 이유: `"NodeNext"`는 Node ESM 런타임과 동일하게 확장자 없는 non-relative(alias) specifier에 대해 `.ts`/`.js` 확장자를 자동으로 시도하지 않아 `@/*` alias 전체가 "module not found"로 실패한다. `"bundler"`는 esbuild(tsx)/번들러처럼 확장자 없는 경로도 탐색하므로 타입 체크 단계에서 `@/*` import가 정상 해석되고, 실제 런타임 경로/확장자 문제는 빌드 시 `tsc-alias --resolve-full-paths`가 책임진다.

- [ ] **Step 6: ESLint flat config 작성**

Create `backend/eslint.config.js`:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "import/no-unresolved": "error",
      "import/no-duplicates": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
  eslintConfigPrettier,
);
```

`@typescript-eslint/no-unused-vars`에 `^_` ignore 패턴을 추가하는 이유: 이 계획 전반에서 `_req`, `_next`, `_drop`처럼 의도적으로 사용하지 않는 매개변수/구조분해 변수에 언더스코어 프리픽스 컨벤션을 쓰기 때문이다.

- [ ] **Step 7: Prettier 설정 작성**

Create `backend/.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 8: .gitignore 작성**

Create `backend/.gitignore`:

```
node_modules/
dist/
.env
*.log
.DS_Store
```

- [ ] **Step 9: .env.example 작성**

Create `backend/.env.example`:

```
NODE_ENV=development
PORT=4000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/in2white
VALKEY_URL=redis://localhost:6379
JWT_SECRET=replace-with-a-long-random-secret-value-min-32-chars
```

- [ ] **Step 10: 설치 검증**

Run: `pnpm install`
Expected: 에러 없이 완료 (아직 `src/`가 없으므로 `pnpm lint`/`pnpm test`는 이후 태스크에서 검증)

- [ ] **Step 11: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml backend/tsconfig.json backend/eslint.config.js backend/.prettierrc backend/.gitignore backend/.env.example
git commit -m "$(cat <<'EOF'
#2/chore: 백엔드 프로젝트 초기화 및 개발 도구 설정

- pnpm 기반 backend/ 프로젝트 생성, 핵심/개발 의존성 설치
- tsconfig(@/* alias), ESLint, Prettier, .env.example 구성
EOF
)"
```

---

### Task 2: 환경변수 검증 및 로거

**Files:**
- Create: `backend/vitest.config.ts`
- Create: `backend/src/config/env.ts`
- Create: `backend/src/utils/logger.ts`
- Test: `backend/tests/env.test.ts`

**Interfaces:**
- Consumes: Task 1의 `zod`, `dotenv`, `pino`, `pino-pretty` 의존성
- Produces: `parseEnv(source: NodeJS.ProcessEnv): Env`, `getEnv(): Env`, `envSchema` (`@/config/env`), `logger` (`@/utils/logger`) — 이후 모든 태스크에서 사용

- [ ] **Step 1: vitest 설정 작성**

Create `backend/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      VALKEY_URL: "redis://localhost:6379",
      JWT_SECRET: "test-secret-key-with-at-least-32-characters",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 2: 실패하는 테스트 작성**

Create `backend/tests/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/config/env";

describe("parseEnv", () => {
  const validSource = {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    VALKEY_URL: "redis://localhost:6379",
    JWT_SECRET: "a".repeat(32),
  };

  it("applies defaults for NODE_ENV and PORT", () => {
    const result = parseEnv(validSource);
    expect(result.NODE_ENV).toBe("development");
    expect(result.PORT).toBe(4000);
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL: _drop, ...rest } = validSource;
    expect(() => parseEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when JWT_SECRET is too short", () => {
    expect(() => parseEnv({ ...validSource, JWT_SECRET: "short" })).toThrow(/JWT_SECRET/);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/config/env'` (파일이 아직 없음)

- [ ] **Step 4: env.ts 구현**

Create `backend/src/config/env.ts`:

```ts
import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  VALKEY_URL: z.string().min(1, "VALKEY_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  return parsed.data;
}

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}
```

`env`를 모듈 로드 시점에 즉시 계산하지 않고 `getEnv()`로 지연 평가하는 이유: 이렇게 하지 않으면 이 모듈을 import하는 모든 테스트가 실제 `process.env`(또는 vitest의 `test.env`) 값에 즉시 의존하게 되어, `parseEnv`를 임의의 값으로 단위 테스트하기 어려워진다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS (3 tests)

- [ ] **Step 6: 로거 구현**

Create `backend/src/utils/logger.ts`:

```ts
import pino from "pino";
import { getEnv } from "@/config/env";

const isDevelopment = getEnv().NODE_ENV === "development";

export const logger = pino({
  level: getEnv().NODE_ENV === "production" ? "info" : "debug",
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
        },
      }
    : undefined,
});
```

- [ ] **Step 7: 린트 확인**

Run: `pnpm lint`
Expected: 에러 없음

- [ ] **Step 8: Commit**

```bash
git add backend/vitest.config.ts backend/tests/env.test.ts backend/src/config/env.ts backend/src/utils/logger.ts
git commit -m "$(cat <<'EOF'
#2/feature: 환경변수 검증 및 로거 설정 추가

- zod 기반 환경변수 스키마(parseEnv/getEnv)와 단위 테스트 작성
- pino(+pino-pretty) 로거 유틸리티 추가
EOF
)"
```

---

### Task 3: 공통 미들웨어 및 async 헬퍼

**Files:**
- Create: `backend/src/utils/async-handler.ts`
- Create: `backend/src/middlewares/rate-limit.middleware.ts`
- Create: `backend/src/middlewares/not-found.middleware.ts`
- Create: `backend/src/middlewares/error-handler.middleware.ts`
- Test: `backend/tests/middlewares.test.ts`

**Interfaces:**
- Consumes: `logger` (`@/utils/logger`, Task 2)
- Produces: `asyncHandler(handler)`, `rateLimitMiddleware`, `notFoundMiddleware`, `errorHandlerMiddleware` — Task 4의 `app.ts`에서 조립

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/tests/middlewares.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { notFoundMiddleware } from "@/middlewares/not-found.middleware";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";
import { rateLimitMiddleware } from "@/middlewares/rate-limit.middleware";

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("notFoundMiddleware", () => {
  it("responds with 404 and route info", () => {
    const req = { method: "GET", originalUrl: "/unknown" } as Request;
    const res = createMockResponse();

    notFoundMiddleware(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "Route not found: GET /unknown", code: "NOT_FOUND" },
    });
  });
});

describe("errorHandlerMiddleware", () => {
  it("responds with 500 and the error message", () => {
    const res = createMockResponse();

    errorHandlerMiddleware(new Error("boom"), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "boom", code: "INTERNAL_SERVER_ERROR" },
    });
  });
});

describe("rateLimitMiddleware", () => {
  it("is an express middleware function", () => {
    expect(typeof rateLimitMiddleware).toBe("function");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test`
Expected: FAIL — 미들웨어 모듈들을 찾을 수 없음

- [ ] **Step 3: async-handler 구현**

Create `backend/src/utils/async-handler.ts`:

```ts
import type { NextFunction, Request, Response } from "express";

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

export function asyncHandler(handler: AsyncRequestHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
```

- [ ] **Step 4: rate-limit 미들웨어 구현**

Create `backend/src/middlewares/rate-limit.middleware.ts`:

```ts
import rateLimit from "express-rate-limit";

export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
```

- [ ] **Step 5: not-found 미들웨어 구현**

Create `backend/src/middlewares/not-found.middleware.ts`:

```ts
import type { NextFunction, Request, Response } from "express";

export function notFoundMiddleware(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      code: "NOT_FOUND",
    },
  });
}
```

- [ ] **Step 6: error-handler 미들웨어 구현**

Create `backend/src/middlewares/error-handler.middleware.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { logger } from "@/utils/logger";

export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error({ err }, "Unhandled error");

  const message = err instanceof Error ? err.message : "Internal server error";

  res.status(500).json({
    error: {
      message,
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS (모든 테스트, Task 2 테스트 포함)

- [ ] **Step 8: 린트 확인 및 Commit**

Run: `pnpm lint`
Expected: 에러 없음

```bash
git add backend/src/utils/async-handler.ts backend/src/middlewares backend/tests/middlewares.test.ts
git commit -m "$(cat <<'EOF'
#2/feature: 공통 미들웨어(rate-limit, 404, 에러 핸들러) 추가

- express-rate-limit 기반 rate limit, 404, 에러 핸들러 미들웨어와 단위 테스트 작성
- 비동기 컨트롤러 에러를 위임하는 asyncHandler 유틸리티 추가
EOF
)"
```

---

### Task 4: Express 앱 조립 및 헬스체크 API

**Files:**
- Create: `backend/src/services/health.service.ts`
- Create: `backend/src/controllers/health.controller.ts`
- Create: `backend/src/routes/health.routes.ts`
- Create: `backend/src/routes/index.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/server.ts`
- Test: `backend/tests/health.test.ts`
- Test: `backend/tests/app.test.ts`

**Interfaces:**
- Consumes: `logger` (Task 2), `rateLimitMiddleware`/`notFoundMiddleware`/`errorHandlerMiddleware` (Task 3), `getEnv()` (Task 2)
- Produces: `createApp(): Express` (`@/app`) — Task 7의 인증 미들웨어 테스트 및 이후 기능 이슈에서 재사용

- [ ] **Step 1: 실패하는 테스트 작성 (health)**

Create `backend/tests/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const app = createApp();
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
```

- [ ] **Step 2: 실패하는 테스트 작성 (app 조립)**

Create `backend/tests/app.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "@/app";

describe("createApp", () => {
  it("returns 404 for unknown routes", async () => {
    const response = await request(createApp()).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/app'`

- [ ] **Step 4: health service 구현**

Create `backend/src/services/health.service.ts`:

```ts
export function getHealthStatus() {
  return {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  };
}
```

- [ ] **Step 5: health controller 구현**

Create `backend/src/controllers/health.controller.ts`:

```ts
import type { Request, Response } from "express";
import { getHealthStatus } from "@/services/health.service";

export function getHealth(_req: Request, res: Response) {
  res.status(200).json(getHealthStatus());
}
```

- [ ] **Step 6: health routes 구현**

Create `backend/src/routes/health.routes.ts`:

```ts
import { Router } from "express";
import { getHealth } from "@/controllers/health.controller";

export const healthRouter = Router();

healthRouter.get("/", getHealth);
```

- [ ] **Step 7: 라우터 결합점 구현**

Create `backend/src/routes/index.ts`:

```ts
import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";

export const router = Router();

router.use("/health", healthRouter);
```

- [ ] **Step 8: Express 앱 조립**

Create `backend/src/app.ts`:

```ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { router } from "@/routes/index";
import { rateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { notFoundMiddleware } from "@/middlewares/not-found.middleware";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";
import { logger } from "@/utils/logger";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(rateLimitMiddleware);

  app.use(router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
```

- [ ] **Step 9: HTTP 서버 부트스트랩**

Create `backend/src/server.ts`:

```ts
import { createApp } from "@/app";
import { getEnv } from "@/config/env";
import { logger } from "@/utils/logger";

const app = createApp();
const env = getEnv();

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully`);
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during shutdown");
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

- [ ] **Step 10: 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS (모든 테스트)

- [ ] **Step 11: 개발 서버로 수동 확인**

Run: `pnpm dev` (다른 터미널에서) → `curl http://localhost:4000/health`
Expected: `{"status":"ok","timestamp":"..."}` 응답 후 서버 종료(Ctrl+C)

- [ ] **Step 12: 린트 확인 및 Commit**

Run: `pnpm lint`
Expected: 에러 없음

```bash
git add backend/src/services/health.service.ts backend/src/controllers/health.controller.ts backend/src/routes backend/src/app.ts backend/src/server.ts backend/tests/health.test.ts backend/tests/app.test.ts
git commit -m "$(cat <<'EOF'
#2/feature: Express 앱 조립 및 헬스체크 API 추가

- routes → controller → service 계층을 관통하는 GET /health 구현
- helmet/cors/compression/rate-limit/에러 핸들러를 조립한 createApp() 및 서버 부트스트랩 추가
EOF
)"
```

---

### Task 5: DB 스키마 및 Drizzle 클라이언트

**Files:**
- Create: `backend/src/db/schema/users.ts`
- Create: `backend/src/db/schema/workspaces.ts`
- Create: `backend/src/db/schema/workspace-memberships.ts`
- Create: `backend/src/db/schema/projects.ts`
- Create: `backend/src/db/schema/whiteboard-documents.ts`
- Create: `backend/src/db/schema/relations.ts`
- Create: `backend/src/db/schema/index.ts`
- Create: `backend/src/db/client.ts`
- Create: `backend/drizzle.config.ts`
- Test: `backend/tests/db-schema.test.ts`
- Test: `backend/tests/db-client.test.ts`

**Interfaces:**
- Consumes: `getEnv()` (Task 2)
- Produces: `db` (`@/db/client`), `users`/`workspaces`/`workspaceMemberships`/`projects`/`whiteboardDocuments` 테이블과 각 `insert*Schema`/`select*Schema` (`@/db/schema`) — 이후 기능 이슈에서 사용

순환 참조를 피하기 위해 테이블 정의 파일은 서로를 참조하지 않고(FK 대상 테이블만 단방향 import), `relations()`는 모든 테이블을 이미 알고 있는 `relations.ts`에 모아 정의한다.

- [ ] **Step 1: users 테이블 정의**

Create `backend/src/db/schema/users.ts`:

```ts
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
```

- [ ] **Step 2: workspaces 테이블 정의**

Create `backend/src/db/schema/workspaces.ts`:

```ts
import { boolean, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "@/db/schema/users";

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces);
export const selectWorkspaceSchema = createSelectSchema(workspaces);
```

- [ ] **Step 3: workspace_memberships 테이블 정의**

Create `backend/src/db/schema/workspace-memberships.ts`:

```ts
import { pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "@/db/schema/users";
import { workspaces } from "@/db/schema/workspaces";

export const workspaceMemberRole = pgEnum("workspace_member_role", ["owner", "member"]);

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceMemberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.workspaceId, table.userId)],
);

export const insertWorkspaceMembershipSchema = createInsertSchema(workspaceMemberships);
export const selectWorkspaceMembershipSchema = createSelectSchema(workspaceMemberships);
```

- [ ] **Step 4: projects 테이블 정의**

Create `backend/src/db/schema/projects.ts`:

```ts
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "@/db/schema/users";
import { workspaces } from "@/db/schema/workspaces";

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projects);
export const selectProjectSchema = createSelectSchema(projects);
```

- [ ] **Step 5: whiteboard_documents 테이블 정의**

Create `backend/src/db/schema/whiteboard-documents.ts`:

```ts
import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "@/db/schema/users";
import { projects } from "@/db/schema/projects";

export const whiteboardDocuments = pgTable("whiteboard_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  canvasContent: jsonb("canvas_content").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertWhiteboardDocumentSchema = createInsertSchema(whiteboardDocuments);
export const selectWhiteboardDocumentSchema = createSelectSchema(whiteboardDocuments);
```

- [ ] **Step 6: 관계(relations) 정의**

Create `backend/src/db/schema/relations.ts`:

```ts
import { relations } from "drizzle-orm";
import { users } from "@/db/schema/users";
import { workspaces } from "@/db/schema/workspaces";
import { workspaceMemberships } from "@/db/schema/workspace-memberships";
import { projects } from "@/db/schema/projects";
import { whiteboardDocuments } from "@/db/schema/whiteboard-documents";

export const usersRelations = relations(users, ({ many }) => ({
  ownedWorkspaces: many(workspaces),
  memberships: many(workspaceMemberships),
  createdProjects: many(projects),
  createdWhiteboardDocuments: many(whiteboardDocuments),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  memberships: many(workspaceMemberships),
  projects: many(projects),
}));

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMemberships.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMemberships.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [projects.creatorId],
    references: [users.id],
  }),
  whiteboardDocuments: many(whiteboardDocuments),
}));

export const whiteboardDocumentsRelations = relations(whiteboardDocuments, ({ one }) => ({
  project: one(projects, {
    fields: [whiteboardDocuments.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [whiteboardDocuments.creatorId],
    references: [users.id],
  }),
}));
```

- [ ] **Step 7: 스키마 re-export**

Create `backend/src/db/schema/index.ts`:

```ts
export * from "@/db/schema/users";
export * from "@/db/schema/workspaces";
export * from "@/db/schema/workspace-memberships";
export * from "@/db/schema/projects";
export * from "@/db/schema/whiteboard-documents";
export * from "@/db/schema/relations";
```

- [ ] **Step 8: 스키마 테스트 작성 및 통과 확인**

Create `backend/tests/db-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

describe("db schema", () => {
  it("exports all five domain tables", () => {
    expect(schema.users).toBeDefined();
    expect(schema.workspaces).toBeDefined();
    expect(schema.workspaceMemberships).toBeDefined();
    expect(schema.projects).toBeDefined();
    expect(schema.whiteboardDocuments).toBeDefined();
  });
});
```

Run: `pnpm test`
Expected: PASS

- [ ] **Step 9: Drizzle 클라이언트 구현**

Create `backend/src/db/client.ts`:

```ts
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getEnv } from "@/config/env";
import * as schema from "@/db/schema";

const queryClient = postgres(getEnv().DATABASE_URL, {
  max: 10,
});

export const db = drizzle(queryClient, { schema });
```

postgres.js는 인스턴스 생성 시점에 즉시 TCP 연결을 맺지 않고 첫 쿼리 실행 시점에 연결하므로, 실제 PostgreSQL 없이도 이 모듈을 import할 수 있다.

- [ ] **Step 10: 클라이언트 테스트 작성 및 통과 확인**

Create `backend/tests/db-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { db } from "@/db/client";

describe("db client", () => {
  it("creates a drizzle instance without connecting", () => {
    expect(db).toBeDefined();
  });
});
```

Run: `pnpm test`
Expected: PASS

- [ ] **Step 11: drizzle-kit 설정 작성**

Create `backend/drizzle.config.ts`:

```ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
```

- [ ] **Step 12: 마이그레이션 SQL 생성**

Run: `DATABASE_URL=postgres://user:pass@localhost:5432/in2white pnpm db:generate`
Expected: `src/db/migrations/0000_*.sql` 파일이 생성됨 (실제 DB 연결 없이 스키마 → SQL 변환만 수행). `src/db/migrations/meta/` 폴더도 함께 생성된다.

- [ ] **Step 13: 린트 확인 및 Commit**

Run: `pnpm lint`
Expected: 에러 없음

```bash
git add backend/src/db backend/drizzle.config.ts backend/tests/db-schema.test.ts backend/tests/db-client.test.ts
git commit -m "$(cat <<'EOF'
#2/feature: Drizzle 기반 DB 스키마 및 클라이언트 추가

- PRODUCT.md 도메인 모델 기준 5개 테이블(users/workspaces/workspace_memberships/
  projects/whiteboard_documents)과 relations, drizzle-zod 스키마 정의
- 지연 연결 postgres.js 클라이언트와 초기 마이그레이션 SQL 생성
EOF
)"
```

---

### Task 6: Valkey 캐시 클라이언트

**Files:**
- Create: `backend/src/cache/valkey.ts`
- Test: `backend/tests/valkey-client.test.ts`

**Interfaces:**
- Consumes: `getEnv()` (Task 2)
- Produces: `valkey` (`@/cache/valkey`) — 이후 기능 이슈(세션/캐시)에서 사용

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/tests/valkey-client.test.ts`:

```ts
import { afterAll, describe, expect, it } from "vitest";
import { valkey } from "@/cache/valkey";

describe("valkey client", () => {
  it("creates a lazy client without connecting", () => {
    expect(valkey.status).toBe("wait");
  });

  afterAll(() => {
    valkey.disconnect();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/cache/valkey'`

- [ ] **Step 3: Valkey 클라이언트 구현**

Create `backend/src/cache/valkey.ts`:

```ts
import Redis from "iovalkey";
import { getEnv } from "@/config/env";

export const valkey = new Redis(getEnv().VALKEY_URL, {
  lazyConnect: true,
});
```

`lazyConnect: true`를 설정해 인스턴스 생성만으로는 실제 연결을 시도하지 않는다(연결은 최초 명령 실행 시점에 이루어진다).

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: 린트 확인 및 Commit**

Run: `pnpm lint`
Expected: 에러 없음

```bash
git add backend/src/cache backend/tests/valkey-client.test.ts
git commit -m "$(cat <<'EOF'
#2/feature: Valkey 캐시 클라이언트 추가

- iovalkey 기반 지연 연결(lazyConnect) 클라이언트와 단위 테스트 작성
EOF
)"
```

---

### Task 7: JWT 유틸리티 및 인증 미들웨어 스켈레톤

**Files:**
- Create: `backend/src/lib/jwt.ts`
- Create: `backend/src/types/express.d.ts`
- Create: `backend/src/middlewares/auth.middleware.ts`
- Test: `backend/tests/jwt.test.ts`
- Test: `backend/tests/auth-middleware.test.ts`

**Interfaces:**
- Consumes: `getEnv()` (Task 2)
- Produces: `signAccessToken`/`verifyAccessToken`/`AccessTokenPayload` (`@/lib/jwt`), `authenticate` 미들웨어 (`@/middlewares/auth.middleware`), `req.user: AccessTokenPayload | undefined` 타입 확장 — 로그인 기능 이슈에서 `signAccessToken`을 그대로 사용

- [ ] **Step 1: 실패하는 테스트 작성 (jwt)**

Create `backend/tests/jwt.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/lib/jwt";

describe("access token", () => {
  it("signs and verifies a round trip", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com" });
    const payload = await verifyAccessToken(token);

    expect(payload.sub).toBe("user-1");
    expect(payload.email).toBe("user@example.com");
  });

  it("rejects a tampered token", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com" });
    const tampered = `${token}tampered`;

    await expect(verifyAccessToken(tampered)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/lib/jwt'`

- [ ] **Step 3: jwt 헬퍼 구현**

Create `backend/src/lib/jwt.ts`:

```ts
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "@/config/env";

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

function getSecretKey() {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecretKey());

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid access token payload");
  }

  return { sub: payload.sub, email: payload.email };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 5: Express Request 타입 확장**

Create `backend/src/types/express.d.ts`:

```ts
import type { AccessTokenPayload } from "@/lib/jwt";

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export {};
```

- [ ] **Step 6: 실패하는 테스트 작성 (auth 미들웨어)**

Create `backend/tests/auth-middleware.test.ts`:

```ts
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authenticate } from "@/middlewares/auth.middleware";
import { signAccessToken } from "@/lib/jwt";

function buildTestApp() {
  const app = express();
  app.get("/protected", authenticate, (req, res) => {
    res.status(200).json({ user: req.user });
  });
  return app;
}

describe("authenticate middleware", () => {
  it("rejects requests without a token", async () => {
    const response = await request(buildTestApp()).get("/protected");
    expect(response.status).toBe(401);
  });

  it("allows requests with a valid token", async () => {
    const token = await signAccessToken({ sub: "user-1", email: "user@example.com" });
    const response = await request(buildTestApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.sub).toBe("user-1");
  });
});
```

- [ ] **Step 7: 테스트 실패 확인**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/middlewares/auth.middleware'`

- [ ] **Step 8: auth 미들웨어 구현**

Create `backend/src/middlewares/auth.middleware.ts`:

```ts
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/lib/jwt";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      error: { message: "Missing bearer token", code: "UNAUTHORIZED" },
    });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = await verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: { message: "Invalid or expired token", code: "UNAUTHORIZED" },
    });
  }
}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `pnpm test`
Expected: PASS (모든 테스트)

- [ ] **Step 10: 린트 확인 및 Commit**

Run: `pnpm lint`
Expected: 에러 없음

```bash
git add backend/src/lib backend/src/types backend/src/middlewares/auth.middleware.ts backend/tests/jwt.test.ts backend/tests/auth-middleware.test.ts
git commit -m "$(cat <<'EOF'
#2/feature: jose 기반 JWT 유틸리티 및 인증 미들웨어 스켈레톤 추가

- signAccessToken/verifyAccessToken 헬퍼와 Authorization 헤더 검증 미들웨어 작성
- req.user 타입 확장 및 라운드트립/미들웨어 단위 테스트 추가
- 로그인 API(비밀번호 검증, 토큰 발급) 자체는 범위 밖으로 남겨둠
EOF
)"
```

---

### Task 8: 커밋 훅 (husky + lint-staged)

**Files:**
- Create: `backend/.lintstagedrc.json`
- Create: `backend/.husky/pre-commit`

**Interfaces:**
- Consumes: Task 1의 `husky`, `lint-staged` 의존성과 `prepare` 스크립트
- Produces: `backend/` 하위 파일을 커밋할 때 자동으로 lint/format을 실행하는 git pre-commit 훅

- [ ] **Step 1: lint-staged 설정 작성**

Create `backend/.lintstagedrc.json`:

```json
{
  "*.{ts,js}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

- [ ] **Step 2: husky 초기화 확인**

Task 1의 `pnpm install` 시점에 `prepare` 스크립트(`cd .. && husky backend/.husky`)가 이미 실행되어 `core.hooksPath`와 `backend/.husky/_` 내부 wrapper가 준비되어 있어야 한다. 확인:

```bash
git config --get core.hooksPath
```

Expected: `backend/.husky/_` 출력. 출력이 없다면 `backend/`에서 `pnpm install`을 다시 실행한다.

- [ ] **Step 3: pre-commit 훅 작성**

Create `backend/.husky/pre-commit`:

```
cd backend && pnpm exec lint-staged
```

Run: `chmod +x backend/.husky/pre-commit`

- [ ] **Step 4: 훅 동작 확인**

`backend/src/utils/logger.ts` 파일 끝에 임시로 빈 줄 하나를 추가한 뒤 stage하고 커밋을 시도해, `eslint --fix`/`prettier --write`가 pre-commit 시점에 실행되는지 확인한다:

```bash
echo "" >> backend/src/utils/logger.ts
git add backend/src/utils/logger.ts
git commit -m "test: pre-commit hook 동작 확인"
```

Expected: 커밋 진행 중 `lint-staged`가 실행되는 로그가 출력되고 커밋이 성공한다. 확인 후 이 테스트용 커밋은 유지해도 무방하다(빈 줄 하나뿐인 변경이므로 실질적 영향 없음). 원치 않으면 `git reset --soft HEAD~1`로 되돌리고 변경을 취소한다.

- [ ] **Step 5: Commit**

```bash
git add backend/.lintstagedrc.json backend/.husky
git commit -m "$(cat <<'EOF'
#2/chore: 커밋 훅(husky, lint-staged) 설정

- backend/ 변경 파일에 대해 pre-commit 시점에 eslint --fix, prettier --write 실행
EOF
)"
```

---

### Task 9: 빌드/경로 alias 검증 및 실행 문서화

**Files:**
- Create: `backend/README.md`

**Interfaces:**
- Consumes: 전체 태스크의 산출물
- Produces: `backend/README.md` (실행 방법 문서) — 이 태스크는 새 소스 코드를 추가하지 않고, 지금까지 만든 스캐폴딩이 스펙의 완료 기준(DoD)을 실제로 만족하는지 최종 검증한다.

- [ ] **Step 1: 전체 테스트/린트 재확인**

Run: `pnpm lint && pnpm test`
Expected: 둘 다 통과

- [ ] **Step 2: 빌드 및 alias 재작성 확인**

Run: `pnpm build`
Expected: `dist/` 생성, 에러 없음. 아래 명령으로 `dist/app.js` 안의 `@/` alias가 상대경로로 재작성되었는지 확인한다:

```bash
grep -n "@/" backend/dist/app.js
```

Expected: 아무 것도 출력되지 않음(모두 상대경로로 치환되어 `@/`가 남아있지 않아야 함). 만약 `@/`가 남아있다면 `tsc-alias`가 `tsconfig.json`의 `paths`를 읽지 못한 것이므로, `backend/tsconfig.json`의 `baseUrl`/`paths` 설정과 `tsc-alias`가 같은 `tsconfig.json`을 기준으로 실행되는지 확인한다.

- [ ] **Step 3: 빌드 산출물 실행 확인**

Run:

```bash
cd backend
DATABASE_URL=postgres://user:pass@localhost:5432/in2white \
VALKEY_URL=redis://localhost:6379 \
JWT_SECRET=replace-with-a-long-random-secret-value-min-32-chars \
pnpm start
```

다른 터미널에서: `curl http://localhost:4000/health`
Expected: `{"status":"ok","timestamp":"..."}` 응답. 확인 후 서버 프로세스를 종료(Ctrl+C)한다.

- [ ] **Step 4: README 작성**

Create `backend/README.md`:

```markdown
# in2white backend

Express + TypeScript(ESM) + MVC 패턴 기반 백엔드. 자세한 설계 배경은
[`../docs/superpowers/specs/2026-09-05-backend-scaffolding-design.md`](../docs/superpowers/specs/2026-09-05-backend-scaffolding-design.md)를 참고한다.

## 요구 사항

- Node.js >= 20
- pnpm

## 시작하기

```bash
cd backend
pnpm install
cp .env.example .env   # 값을 환경에 맞게 수정
pnpm dev
```

`GET http://localhost:4000/health`로 서버가 떠 있는지 확인할 수 있다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `pnpm dev` | 개발 서버 실행 (파일 변경 시 자동 재시작) |
| `pnpm build` | `dist/`로 프로덕션 빌드 (경로 alias는 `tsc-alias`가 상대경로로 재작성) |
| `pnpm start` | 빌드된 `dist/server.js` 실행 |
| `pnpm lint` / `pnpm format` | ESLint 검사 / Prettier 포맷팅 |
| `pnpm test` | vitest 테스트 실행 |
| `pnpm db:generate` | drizzle 스키마로부터 마이그레이션 SQL 생성 |
| `pnpm db:migrate` | 생성된 마이그레이션을 DB에 적용 |
| `pnpm db:studio` | drizzle-kit studio 실행 |

## 폴더 구조

`routes` → `controllers` → `services` → `db/schema`로 이어지는 계층형 MVC 구조를 따른다. 새 도메인 기능을 추가할 때도 이 계층 구조를 그대로 따라 파일을 추가한다.

## 범위

이 프로젝트는 현재 기술 기반(스캐폴딩) 단계다. 로그인, Workspace/Project/Whiteboard Document CRUD, 실시간 협업 등 실제 도메인 기능은 아직 구현되어 있지 않다.
```

- [ ] **Step 5: Commit**

```bash
git add backend/README.md
git commit -m "$(cat <<'EOF'
#2/docs: 백엔드 프로젝트 실행 방법 문서화

- 로컬 실행/빌드/테스트 스크립트와 폴더 구조, 현재 범위를 README에 정리
- 빌드 산출물의 경로 alias 재작성 및 dev/build 실행 경로 DoD 최종 검증
EOF
)"
```
