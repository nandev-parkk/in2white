# 워크스페이스 생성 백엔드 구현 계획

> **에이전트 작업자용:** 이 계획을 실행할 때는 각 태스크를 순서대로 처리하고, 테스트 사이클을 확인한다. 구현 방식은 superpowers:test-driven-development 지침을 따른다. 단계는 체크박스로 추적한다.

**Goal:** 인증된 사용자가 워크스페이스 이름을 제출하면 비기본 워크스페이스와 소유자 멤버십을 원자적으로 생성하는 POST /workspaces API를 구현한다.

**Architecture:** 기존 백엔드의 routes → controllers → services → db/schema 계층을 따른다. 컨트롤러는 요청 검증과 응답 변환만 담당하고, 서비스는 Drizzle 트랜잭션 안에서 workspaces 행과 workspace_memberships의 owner 행을 함께 생성한다. 인증된 JWT의 sub를 소유자 ID로 사용하며 요청 본문에는 소유자 ID나 멤버 목록을 받지 않는다.

**Tech Stack:** Express, TypeScript ESM, Drizzle ORM/PostgreSQL, Zod, jose JWT, Vitest, Supertest, pnpm.

**Spec:** PRODUCT.md의 Core Domain Model Workspace/WorkspaceMembership 항목과 User Flow 워크스페이스 생성 및 멤버 추가 항목(특히 생성자 자동 소유자 등록)을 구현한다.

## Global Constraints

- 패키지 매니저는 pnpm을 사용한다.
- 인증은 기존 authenticate 미들웨어를 사용하고 Authorization: Bearer <access-token>이 없는 요청은 401 UNAUTHORIZED로 종료한다.
- 워크스페이스 이름은 앞뒤 공백을 제거한 뒤 1자 이상 255자 이하만 허용한다.
- 생성되는 워크스페이스는 isDefault=false이며, 기본 워크스페이스 자동 생성 로직은 이 작업 범위에 포함하지 않는다.
- 생성자 본인의 멤버십만 role=owner로 자동 생성한다. 추가 멤버 선택/추가 API는 별도 작업이다.
- 워크스페이스 삽입과 소유자 멤버십 삽입은 하나의 Drizzle 트랜잭션에서 수행하며, 두 번째 삽입이 실패하면 오류를 컨트롤러 밖으로 전파해 트랜잭션 롤백을 맡긴다.
- 성공 응답은 201과 { workspace: ... } 형태로 반환한다.
- 기존 workspaces와 workspace_memberships 테이블 및 마이그레이션을 재사용하므로 새 DB 마이그레이션은 생성하지 않는다.
- 문서와 사용자에게 노출되는 검증 메시지는 한국어로 작성한다.
- Git 커밋은 사용자가 요청하기 전에는 실행하지 않는다.

---

## 파일 구조와 책임

- Modify: backend/tests/workspace.test.ts — POST /workspaces의 HTTP 계약, 인증, 검증, 트랜잭션 호출을 검증한다. 현재 작업 중 작성된 RED 테스트 초안을 완성한다.
- Create: backend/src/schemas/workspace.schema.ts — 워크스페이스 생성 요청의 Zod 계약과 입력 타입을 정의한다.
- Modify: backend/src/constants/messages.ts — 워크스페이스 이름 검증 메시지를 추가한다.
- Create: backend/src/services/workspace.service.ts — 워크스페이스와 소유자 멤버십을 동일한 DB 트랜잭션으로 생성한다.
- Create: backend/src/controllers/workspace.controller.ts — 요청 본문 검증, 인증 사용자 확인, 서비스 호출, 201 응답을 담당한다.
- Create: backend/src/routes/workspace.routes.ts — POST /에 인증 미들웨어와 컨트롤러를 연결한다.
- Modify: backend/src/routes/index.ts — /workspaces 라우터를 전역 라우터에 마운트한다.
- No change: backend/src/db/schema/workspaces.ts, backend/src/db/schema/workspace-memberships.ts, backend/src/db/migrations/ — 필요한 테이블과 제약조건이 이미 존재한다.

### API 계약

요청:

~~~http
POST /workspaces
Authorization: Bearer <access-token>
Content-Type: application/json

{ "name": "Brand Studio" }
~~~

성공 응답:

~~~json
{
  "workspace": {
    "id": "workspace-1",
    "name": "Brand Studio",
    "ownerId": "user-1",
    "isDefault": false,
    "createdAt": "2026-09-07T00:00:00.000Z"
  }
}
~~~

실패 응답:

- 인증 헤더 없음/유효하지 않은 토큰: 기존 미들웨어의 401, UNAUTHORIZED 응답
- 이름이 비어 있거나 255자를 초과함: 400, VALIDATION_ERROR
- 예상하지 못한 DB 오류: 기존 에러 핸들러의 500, INTERNAL_SERVER_ERROR 응답

---

### Task 1: RED 테스트로 API 계약 고정

**Files:**

- Modify: backend/tests/workspace.test.ts

**Interfaces:**

- Consumes: 기존 createApp, signAccessToken, workspaces 스키마, db.transaction mock
- Produces: 구현이 만족해야 하는 POST /workspaces의 요청·응답·트랜잭션 계약

- [ ] **Step 1: 성공 케이스 테스트를 완성한다**

user-1의 access token으로 { name: "Brand Studio" }를 전송한다. 트랜잭션 mock은 workspace 삽입과 membership 삽입을 같은 transaction 객체에서 수행할 수 있도록 구성한다.

~~~ts
expect(response.status).toBe(201);
expect(response.body.workspace).toEqual({
  ...createdWorkspace,
  createdAt: createdWorkspace.createdAt.toISOString(),
});
expect(db.transaction).toHaveBeenCalledOnce();
expect(workspaceInsert.values).toHaveBeenCalledWith({
  name: "Brand Studio",
  ownerId: "user-1",
  isDefault: false,
});
expect(membershipInsert.values).toHaveBeenCalledWith({
  workspaceId: "workspace-1",
  userId: "user-1",
  role: "owner",
});
~~~

- [ ] **Step 2: 인증 실패 테스트를 추가한다**

Authorization 헤더 없이 POST /workspaces를 호출하고 401 및 UNAUTHORIZED를 검증한다. 이 요청에서는 db.transaction이 호출되지 않아야 한다.

~~~ts
const response = await request(createApp())
  .post("/workspaces")
  .send({ name: "Brand Studio" });

expect(response.status).toBe(401);
expect(response.body.error.code).toBe("UNAUTHORIZED");
expect(db.transaction).not.toHaveBeenCalled();
~~~

- [ ] **Step 3: 이름 검증 실패 테스트를 추가한다**

유효한 access token으로 공백만 포함한 이름을 전송하고 400 VALIDATION_ERROR를 검증한다. 입력이 유효하지 않으므로 트랜잭션을 시작하지 않아야 한다.

~~~ts
const response = await request(createApp())
  .post("/workspaces")
  .set("Authorization", "Bearer " + (await createAccessToken()))
  .send({ name: "   " });

expect(response.status).toBe(400);
expect(response.body.error.code).toBe("VALIDATION_ERROR");
expect(db.transaction).not.toHaveBeenCalled();
~~~

- [ ] **Step 4: 두 번째 삽입 오류가 전파되는지 테스트한다**

트랜잭션 callback 안에서 멤버십 삽입이 reject되도록 구성하고 500 INTERNAL_SERVER_ERROR를 검증한다. 이 테스트는 실제 PostgreSQL rollback 자체가 아니라, 서비스가 DB 트랜잭션 callback 밖에서 오류를 삼키지 않는 계약을 고정한다.

~~~ts
const workspaceInsert = {
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([
    {
      id: "workspace-1",
      name: "Brand Studio",
      ownerId: "user-1",
      isDefault: false,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
    },
  ]),
};
const membershipInsert = {
  values: vi.fn().mockRejectedValue(new Error("membership insert failed")),
};
const transaction = {
  insert: vi.fn((table: unknown) =>
    table === workspaces ? workspaceInsert : membershipInsert,
  ),
};
vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

const response = await request(createApp())
  .post("/workspaces")
  .set("Authorization", "Bearer " + (await createAccessToken()))
  .send({ name: "Brand Studio" });

expect(response.status).toBe(500);
expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
~~~

- [ ] **Step 5: RED 상태를 확인한다**

Run: pnpm --dir backend exec vitest run tests/workspace.test.ts

Expected: POST /workspaces 라우트가 아직 등록되지 않았으므로 성공·검증·오류 시나리오가 기대 상태와 다르게 실패한다. 이 단계에서 테스트가 통과하면 테스트가 새 동작을 검증하지 못하는 것이므로 테스트를 먼저 점검한다.

### Task 2: 요청 계약과 트랜잭션 서비스 구현

**Files:**

- Create: backend/src/schemas/workspace.schema.ts
- Modify: backend/src/constants/messages.ts
- Create: backend/src/services/workspace.service.ts

**Interfaces:**

- Consumes: workspaces, workspaceMemberships, 기존 db Drizzle client
- Produces: createWorkspace(input: { name: string; ownerId: string }): Promise<typeof workspaces.$inferSelect>

- [ ] **Step 1: 요청 검증 스키마를 작성한다**

backend/src/constants/messages.ts에 다음 두 메시지를 추가한다.

~~~ts
WORKSPACE_NAME_REQUIRED: "워크스페이스 이름을 입력해주세요",
WORKSPACE_NAME_TOO_LONG: "워크스페이스 이름은 255자 이내로 입력해주세요",
~~~

backend/src/schemas/workspace.schema.ts에 기존 loginSchema 패턴을 따라 다음 계약을 작성한다.

~~~ts
import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

export const createWorkspaceSchema = z.object({
  name: z
    .string({ error: ERROR_MESSAGES.WORKSPACE_NAME_REQUIRED })
    .trim()
    .min(1, ERROR_MESSAGES.WORKSPACE_NAME_REQUIRED)
    .max(255, ERROR_MESSAGES.WORKSPACE_NAME_TOO_LONG),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
~~~

- [ ] **Step 2: 트랜잭션 서비스의 입력과 반환값을 정의한다**

backend/src/services/workspace.service.ts에서 입력 타입과 반환 타입을 명시한다.

~~~ts
import { db } from "@/db/client";
import { workspaceMemberships, workspaces } from "@/db/schema";

export interface CreateWorkspaceInput {
  name: string;
  ownerId: string;
}

export async function createWorkspace({
  name,
  ownerId,
}: CreateWorkspaceInput): Promise<typeof workspaces.$inferSelect> {
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name, ownerId, isDefault: false })
      .returning();

    if (!workspace) {
      throw new Error("Workspace insert returned no row");
    }

    await tx.insert(workspaceMemberships).values({
      workspaceId: workspace.id,
      userId: ownerId,
      role: "owner",
    });

    return workspace;
  });
}
~~~

- [ ] **Step 3: 서비스가 두 삽입을 같은 transaction 객체로 수행하는지 정적 검토한다**

서비스에서 db.insert(...)를 직접 호출하지 않고 반드시 db.transaction(async (tx) => ...)의 tx.insert(...)만 사용하는지 확인한다. 첫 번째 삽입 결과의 workspace.id를 두 번째 삽입의 workspaceId로 사용하고, ownerId를 멤버십의 userId로 사용해야 한다.

### Task 3: HTTP 계층 연결 및 GREEN 전환

**Files:**

- Create: backend/src/controllers/workspace.controller.ts
- Create: backend/src/routes/workspace.routes.ts
- Modify: backend/src/routes/index.ts
- Test: backend/tests/workspace.test.ts

**Interfaces:**

- Consumes: createWorkspaceSchema, createWorkspace, authenticate, asyncHandler
- Produces: POST /workspaces endpoint

- [ ] **Step 1: 컨트롤러에서 인증 사용자와 요청을 변환한다**

createWorkspaceHandler(req, res)는 다음 순서로 동작한다.

1. req.user가 없으면 401, UNAUTHORIZED, 기존 MISSING_BEARER_TOKEN 메시지를 가진 HttpError를 throw한다.
2. createWorkspaceSchema.safeParse(req.body)를 호출한다.
3. 실패하면 첫 번째 Zod issue message를 사용해 400, VALIDATION_ERROR를 throw한다.
4. 성공하면 createWorkspace({ name: parsed.data.name, ownerId: req.user.sub })를 호출한다.
5. 반환된 행을 { workspace }로 감싸 201 JSON으로 응답한다.

구현 형태는 기존 loginHandler와 동일한 컨트롤러 경계를 유지한다.

- [ ] **Step 2: 라우터를 작성한다**

backend/src/routes/workspace.routes.ts에 다음 매핑을 작성한다.

~~~ts
import { Router } from "express";
import { createWorkspaceHandler } from "@/controllers/workspace.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const workspaceRouter = Router();

workspaceRouter.post("/", authenticate, asyncHandler(createWorkspaceHandler));
~~~

- [ ] **Step 3: 전역 라우터에 /workspaces를 마운트한다**

backend/src/routes/index.ts에 workspaceRouter를 import하고 다음을 추가한다.

~~~ts
router.use("/workspaces", workspaceRouter);
~~~

- [ ] **Step 4: RED 테스트를 다시 실행해 GREEN을 확인한다**

Run: pnpm --dir backend exec vitest run tests/workspace.test.ts

Expected: workspace.test.ts의 성공, 인증 실패, 이름 검증 실패, DB 오류 전파 테스트가 모두 PASS한다.

- [ ] **Step 5: 구현 파일의 lint/format을 확인한다**

Run: pnpm --dir backend exec eslint src/schemas/workspace.schema.ts src/services/workspace.service.ts src/controllers/workspace.controller.ts src/routes/workspace.routes.ts src/routes/index.ts

Expected: lint error가 없다. 포맷 불일치가 있으면 기존 Prettier 규칙에 맞춰 해당 파일만 정리한다.

### Task 4: 전체 백엔드 회귀 검증

**Files:**

- Verify: backend/src/db/migrations/
- Verify: backend/tests/

**Interfaces:**

- Consumes: 완료된 POST /workspaces endpoint와 기존 백엔드 테스트 스위트
- Produces: 테스트·린트·빌드를 통과한 백엔드 변경

- [ ] **Step 1: 전체 테스트를 실행한다**

Run: pnpm --dir backend test

Expected: 기존 테스트와 workspace.test.ts가 모두 PASS하며, 처리되지 않은 오류 로그나 테스트 경고가 없다.

- [ ] **Step 2: 백엔드 빌드를 실행한다**

Run: pnpm --dir backend build

Expected: TypeScript 타입 오류 없이 backend/dist가 생성된다.

- [ ] **Step 3: 백엔드 전체 lint를 실행한다**

Run: pnpm --dir backend lint

Expected: 기존 파일과 새 파일 모두 lint error 없이 통과한다.

- [ ] **Step 4: 마이그레이션 변경이 없는지 확인한다**

Run: git status --short 및 git diff -- backend/src/db/migrations backend/src/db/schema

Expected: 워크스페이스 생성 endpoint만 추가하므로 schema/migration 파일에 불필요한 변경이 없다.

- [ ] **Step 5: 최종 변경 목록과 API 계약을 확인한다**

다음 파일만 기능 구현에 필요한 변경으로 남아 있는지 확인한다.

~~~text
backend/tests/workspace.test.ts
backend/src/schemas/workspace.schema.ts
backend/src/constants/messages.ts
backend/src/services/workspace.service.ts
backend/src/controllers/workspace.controller.ts
backend/src/routes/workspace.routes.ts
backend/src/routes/index.ts
~~~

커밋은 사용자 요청이 있을 때만 수행한다.

---

## 완료 기준

- 인증된 사용자가 POST /workspaces에 이름을 보내면 201과 생성된 workspace를 받는다.
- 생성자의 JWT sub가 workspace의 ownerId가 된다.
- 생성자는 동일 workspace에 owner role의 membership을 가진다.
- workspace와 membership 생성은 한 트랜잭션에서 수행된다.
- 이름이 비어 있거나 255자를 초과하면 DB를 호출하지 않고 400 VALIDATION_ERROR를 반환한다.
- 인증되지 않은 요청은 401이다.
- 기존 백엔드 테스트, 새 테스트, lint, build가 모두 통과한다.
- 추가 멤버 초대/추가, workspace 목록, 기본 workspace 생성, 프론트엔드 연동은 이 작업에 포함되지 않는다.
