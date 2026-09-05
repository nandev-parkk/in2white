# 백엔드 프로젝트 초기 설정 (스캐폴딩) 설계

- Issue: [#2 백엔드 프로젝트 초기 설정 (Express + TypeScript + MVC)](https://github.com/nandev-parkk/in2white/issues/2)
- 관련 문서: [`PRODUCT.md`](../../../PRODUCT.md)

## 1. 목표

`in2white` 백엔드의 기술 기반(스캐폴딩)을 구성한다. 이 단계에서는 실제 도메인 기능(로그인, Workspace/Project/Whiteboard Document CRUD, 실시간 협업)을 구현하지 않는다. 대신 이후 기능 이슈들이 곧바로 비즈니스 로직 작성에 들어갈 수 있도록 프로젝트 구조, 개발 도구, DB/캐시 연결, 인증 유틸리티, 예시 API(헬스체크)를 준비한다.

### Non-Goals

- 로그인 등 인증 API 자체 구현 (jose 기반 sign/verify 헬퍼와 미들웨어 스켈레톤만 준비)
- Workspace / Project / Whiteboard Document의 CRUD 엔드포인트
- 실시간 협업(WebSocket, Presence, Excalidraw 동기화) 계층
- 프론트엔드 연동

## 2. 폴더 구조

저장소 루트에 `backend/` 디렉터리를 신설한다. 독립된 Node.js 프로젝트(자체 `package.json`)로 구성하며, 현재는 별도 워크스페이스(monorepo) 설정 없이 단일 패키지로 둔다.

```
backend/
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
├── eslint.config.js
├── .prettierrc
├── .lintstagedrc.json
├── drizzle.config.ts
├── vitest.config.ts
├── .husky/
│   └── pre-commit                 # lint-staged 실행
├── src/
│   ├── app.ts                     # Express 앱 조립 (미들웨어 등록, 라우터 마운트)
│   ├── server.ts                  # HTTP 서버 부트스트랩 + graceful shutdown
│   ├── config/
│   │   └── env.ts                 # 환경변수 zod 스키마 검증 및 export
│   ├── db/
│   │   ├── client.ts              # drizzle + postgres(postgres.js) 커넥션
│   │   └── schema/
│   │       ├── users.ts
│   │       ├── workspaces.ts
│   │       ├── workspace-memberships.ts
│   │       ├── projects.ts
│   │       ├── whiteboard-documents.ts
│   │       └── index.ts           # 전체 schema re-export
│   ├── cache/
│   │   └── valkey.ts              # iovalkey 클라이언트 초기화
│   ├── routes/
│   │   ├── index.ts               # 라우터 결합점
│   │   └── health.routes.ts
│   ├── controllers/
│   │   └── health.controller.ts
│   ├── services/
│   │   └── health.service.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # jose 기반 Authorization 헤더 검증 스켈레톤
│   │   ├── rate-limit.middleware.ts  # express-rate-limit 설정
│   │   ├── error-handler.middleware.ts
│   │   └── not-found.middleware.ts
│   ├── lib/
│   │   └── jwt.ts                 # jose sign/verify 헬퍼 함수
│   ├── utils/
│   │   ├── logger.ts              # pino 인스턴스
│   │   └── async-handler.ts       # async 컨트롤러 에러 위임 헬퍼
│   └── types/
│       └── express.d.ts           # Express Request 확장 (req.user)
└── tests/
    └── health.test.ts             # supertest 기반 헬스체크 스모크 테스트
```

계층 책임:

- **routes**: URL과 컨트롤러 매핑만 담당.
- **controllers**: HTTP 요청/응답 변환(파싱, 상태 코드)만 담당하고 로직은 services에 위임.
- **services**: 비즈니스 로직. DB/캐시 접근은 이 계층에서 수행.
- **db/schema**: drizzle 스키마 정의(모델 계층 역할).

이후 기능 이슈에서 위 계층 구조를 그대로 따라 도메인별 파일(예: `workspace.controller.ts`, `workspace.service.ts`)을 추가한다. 기능이 늘어나 계층이 비대해지면 도메인별 하위 폴더로 재구성하는 것은 그 시점에 별도로 검토한다.

## 3. 핵심 라이브러리

| 목적 | 라이브러리 |
|---|---|
| 웹 프레임워크 | express |
| 보안/공통 미들웨어 | cors, helmet, compression, express-rate-limit |
| ORM / 마이그레이션 | drizzle-orm, drizzle-kit |
| PostgreSQL 드라이버 | postgres (postgres.js) |
| 캐시 클라이언트 | iovalkey |
| 인증 | jose |
| 검증 | zod, drizzle-zod (drizzle 스키마 → zod 스키마 생성) |
| 환경변수 로딩 | dotenv |
| 로깅 | pino, pino-http |
| 개발 서버 | tsx |
| 타입 | typescript, @types/express 등 |
| 린트/포맷 | eslint, prettier, typescript-eslint |
| 커밋 훅 | husky, lint-staged |
| 경로 alias | tsc-alias (빌드 산출물의 alias를 상대경로로 재작성) |
| 테스트 | vitest, supertest |

패키지 매니저는 pnpm을 사용한다.

## 4. 모듈 시스템 & 스크립트

`package.json`에 `"type": "module"`을 지정해 ESM으로 구성한다 (jose, drizzle-kit, tsx 모두 ESM 친화적).

### 경로 alias

`tsconfig.json`에 `baseUrl: "."`, `paths: { "@/*": ["src/*"] }`를 설정해 `@/utils/logger`처럼 절대경로 스타일 import를 사용한다.

- 개발(`tsx`)은 esbuild 기반이라 tsconfig의 `paths`를 자동으로 인식해 별도 설정 없이 동작한다.
- 프로덕션 빌드(`tsc`)는 타입 체크만 하고 alias를 실제 경로로 바꿔주지 않으므로, 빌드 직후 `tsc-alias`로 `dist/` 산출물의 import 경로를 상대경로로 재작성한다.

스크립트:

- `dev`: `tsx watch src/server.ts`
- `build`: `tsc && tsc-alias`
- `start`: `node dist/server.js`
- `lint`: `eslint .`
- `format`: `prettier --write .`
- `test`: `vitest run`
- `db:generate`: `drizzle-kit generate`
- `db:migrate`: `drizzle-kit migrate`
- `db:studio`: `drizzle-kit studio`
- `prepare`: `husky` (pnpm install 시 자동으로 git hook 설치)

### 커밋 훅

`husky`로 `.husky/pre-commit` 훅을 등록하고 `lint-staged`가 staged된 파일에 대해 `eslint --fix`, `prettier --write`를 실행한다. 설정은 `.lintstagedrc.json`에 정의한다.

## 5. 환경 변수

`dotenv`로 `.env` 파일을 로드한 뒤, `src/config/env.ts`에서 zod로 다음 값을 검증한다:

- `NODE_ENV` (development/test/production)
- `PORT`
- `DATABASE_URL` (PostgreSQL 접속 문자열)
- `VALKEY_URL` (Valkey 접속 문자열)
- `JWT_SECRET` (또는 JWK 관련 값 — jose 헬퍼가 사용할 서명 키)

`.env.example`에 위 키의 예시 값을 채워 문서화한다.

## 6. DB 스키마 초안

`PRODUCT.md`의 Core Domain Model(5장)을 기준으로 다음 테이블을 정의한다.

- **users**: id(uuid, pk), name, email(unique), password_hash, created_at
- **workspaces**: id(uuid, pk), name, owner_id(fk → users), is_default(boolean), created_at
- **workspace_memberships**: id(uuid, pk), workspace_id(fk), user_id(fk), role(enum: owner/member), created_at — (workspace_id, user_id) unique 제약
- **projects**: id(uuid, pk), workspace_id(fk), name, description(nullable), creator_id(fk → users), created_at, updated_at
- **whiteboard_documents**: id(uuid, pk), project_id(fk), name, creator_id(fk → users), canvas_content(jsonb), created_at, updated_at

관계는 모두 drizzle의 `relations()`로 명시한다. 이 단계에서는 실제 마이그레이션을 로컬 DB에 적용하지 않고, `drizzle-kit generate`로 마이그레이션 SQL만 생성해 커밋한다(실행/검증은 인프라 준비 후 기능 이슈에서 진행).

각 테이블마다 `drizzle-zod`의 `createInsertSchema`/`createSelectSchema`로 대응하는 zod 스키마를 함께 export한다(`db/schema/*.ts` 내 정의). 이렇게 하면 다음 기능 이슈에서 컨트롤러 요청 검증 시 DB 스키마와 어긋나지 않는 zod 스키마를 바로 재사용할 수 있다.

## 7. 인증 유틸리티 (스켈레톤)

- `lib/jwt.ts`: `signAccessToken(payload)`, `verifyAccessToken(token)` 형태로 jose(`SignJWT`, `jwtVerify`)를 감싼 헬퍼 제공.
- `middlewares/auth.middleware.ts`: `Authorization: Bearer <token>` 헤더를 검증해 `req.user`에 payload를 주입하는 `authenticate` 미들웨어. 실패 시 401 응답.
- 로그인 엔드포인트(비밀번호 검증, 토큰 발급 API)는 구현하지 않는다 — 다음 인증 기능 이슈의 범위.

## 8. 공통 미들웨어 / 에러 처리

- `error-handler.middleware.ts`: 처리되지 않은 에러를 pino로 로깅 후 일관된 JSON 에러 응답(`{ error: { message, code } }`) 반환.
- `not-found.middleware.ts`: 매칭되는 라우트가 없을 때 404 JSON 응답.
- `rate-limit.middleware.ts`: `express-rate-limit`으로 기본 rate limit(예: 15분당 IP당 100회)을 적용하는 미들웨어. `app.ts`에서 전역으로 등록한다.
- `utils/async-handler.ts`: 비동기 컨트롤러의 reject를 `next(err)`로 위임.

## 9. 검증용 예시 API

`GET /health` 엔드포인트를 routes → controller → service 전 계층을 거쳐 구현한다. DB/캐시 연결 상태까지는 확인하지 않고 프로세스 자체의 생존 여부(`{ status: "ok" }`)만 반환한다. `tests/health.test.ts`에서 supertest로 200 응답을 검증해 스캐폴딩이 실제로 동작함을 보인다.

## 10. 테스트 전략

이번 단계에서는 헬스체크 스모크 테스트 1건만 작성한다. 도메인 기능 테스트는 각 기능 이슈에서 TDD로 추가한다.

## 11. 완료 기준 (Definition of Done)

- `pnpm install` 후 `pnpm dev`로 서버가 기동되고 `GET /health`가 200을 반환한다(내부에서 `@/*` alias import 사용).
- `pnpm build && pnpm start`로도 동일하게 `GET /health`가 200을 반환한다(빌드 산출물에서 alias가 정상적으로 상대경로로 재작성되었는지 확인).
- `pnpm lint`, `pnpm test`가 통과한다.
- `pnpm install` 시 `prepare` 스크립트로 `.husky/pre-commit` 훅이 설치되고, staged 파일에 대해 lint-staged가 동작한다.
- `pnpm db:generate` 실행 시 5개 테이블에 대한 마이그레이션 SQL이 생성된다(로컬 DB 적용은 범위 밖).
- 실제 PostgreSQL/Valkey 인스턴스 없이도 위 항목이 모두 확인 가능해야 한다. `db/client.ts`와 `cache/valkey.ts`는 모듈 로드 시점에 연결을 강제하지 않는 지연 연결 방식(postgres.js, iovalkey 모두 기본적으로 지연 연결 지원)으로 구성하고, `GET /health`는 DB/캐시 상태를 확인하지 않고 프로세스 생존만 반환한다.
