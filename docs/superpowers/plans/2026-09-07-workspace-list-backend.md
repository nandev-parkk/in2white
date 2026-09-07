# 워크스페이스 목록 조회 백엔드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인한 사용자가 자신이 소속된 모든 워크스페이스와 현재 역할을 조회할 수 있는 `GET /workspaces` API를 추가한다.

**Architecture:** 기존 `workspaceRouter`에 인증된 GET 엔드포인트를 추가하고, 컨트롤러는 인증 주체의 사용자 ID를 서비스에 전달한다. 서비스는 `workspace_memberships`를 기준으로 `workspaces`를 내부 조인해 사용자 소속 범위만 조회하며, 멤버십 역할을 응답 항목에 포함한다. 기존 워크스페이스 생성 API와 공통 인증·에러 처리 구조는 그대로 재사용한다.

**Tech Stack:** Express, TypeScript, Drizzle ORM, PostgreSQL, Zod, Vitest, Supertest

**Spec:** `PRODUCT.md` §5 Workspace 및 WorkspaceMembership, `DESIGN.md` §8.21 Workspace Switcher 및 §9.2 List

## Global Constraints

- API 경로는 `GET /workspaces`로 고정하고 기존 `workspaceRouter` 아래에 등록한다.
- 인증은 기존 `authenticate` 미들웨어를 사용하며, `req.user.sub`를 멤버십 조회의 `userId`로 사용한다.
- 데이터 범위는 `workspace_memberships.user_id = req.user.sub`인 워크스페이스로만 제한한다.
- 응답은 `{ workspaces: WorkspaceListItem[] }` 형태이며 각 항목에 `id`, `name`, `ownerId`, `isDefault`, `createdAt`, `role`을 포함한다.
- `role`은 데이터베이스 멤버십의 `owner | member` 값을 그대로 반환한다.
- 정렬은 기본 워크스페이스 우선(`isDefault DESC`), 생성일 오름차순(`createdAt ASC`), ID 오름차순(`id ASC`)으로 고정한다.
- 소속 워크스페이스가 없으면 오류가 아니라 `200`과 빈 배열을 반환한다.
- 검색, 페이지네이션, 멤버 상세 정보, 워크스페이스별 프로젝트 수는 이번 범위에 포함하지 않는다.
- 기존 워크스페이스·멤버십 스키마와 마이그레이션은 변경하지 않는다.
- 기존 `POST /workspaces` 동작과 테스트를 변경하지 않는다.
- 새 동작은 테스트를 먼저 작성하고 실패를 확인한 뒤 production code를 작성한다.
- 현재 워크트리의 워크스페이스 생성 기능 변경 사항은 기존 작업으로 간주하고 보존한다.
- 사용자 요청이 없으므로 커밋·푸시·병합은 실행하지 않는다.
- 구현·테스트·계획 문서는 프로젝트 규칙에 따라 한국어로 작성한다.

---

### Task 1: 워크스페이스 목록 조회 실패 테스트 작성

**Files:**
- Modify: `backend/tests/workspace.test.ts`

**Interfaces:**
- Consumes: 기존 `createApp`, `signAccessToken`, `db` mock, `POST /workspaces` 테스트 구조
- Produces: `GET /workspaces`가 제공해야 하는 인증·성공·빈 목록·DB 오류 계약

- [ ] **Step 1: 목록 조회용 DB mock을 추가한다**

기존 `@/db/client` mock에 `select: vi.fn()`을 추가하고, 기존 `transaction` reset과 함께 `select`도 매 테스트 전에 reset한다.

```ts
vi.mock("@/db/client", () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(db.transaction).mockReset();
  vi.mocked(db.select).mockReset();
});
```

목록 쿼리 체인을 준비하는 테스트 전용 helper를 추가한다. 이 helper는 실제 Drizzle 쿼리를 대체하는 것이 아니라, 서비스가 `from`, `innerJoin`, `where`, `orderBy`를 순서대로 호출하고 마지막 Promise를 기다리는지 검증할 수 있도록 체인을 제공한다.

```ts
function mockWorkspaceListQuery(rows: unknown[]) {
  const query = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };

  vi.mocked(db.select).mockReturnValue(query as never);
  return query;
}
```

- [ ] **Step 2: 인증된 성공 응답의 failing test를 작성한다**

기존 `describe("POST /workspaces")`와 별도로 `describe("GET /workspaces")`를 만들고, 두 개의 목록 항목과 서로 다른 멤버십 역할을 반환하는 테스트를 추가한다.

```ts
describe("GET /workspaces", () => {
  it("returns the authenticated user's workspaces with membership roles", async () => {
    const createdAt = new Date("2026-09-07T00:00:00.000Z");
    const query = mockWorkspaceListQuery([
      {
        id: "workspace-default",
        name: "My Workspace",
        ownerId: "user-1",
        isDefault: true,
        createdAt,
        role: "owner",
      },
      {
        id: "workspace-member",
        name: "Brand Studio",
        ownerId: "user-2",
        isDefault: false,
        createdAt,
        role: "member",
      },
    ]);

    const response = await request(createApp())
      .get("/workspaces")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.workspaces).toEqual([
      {
        id: "workspace-default",
        name: "My Workspace",
        ownerId: "user-1",
        isDefault: true,
        createdAt: createdAt.toISOString(),
        role: "owner",
      },
      {
        id: "workspace-member",
        name: "Brand Studio",
        ownerId: "user-2",
        isDefault: false,
        createdAt: createdAt.toISOString(),
        role: "member",
      },
    ]);
    expect(db.select).toHaveBeenCalledOnce();
    expect(query.from).toHaveBeenCalledOnce();
    expect(query.innerJoin).toHaveBeenCalledOnce();
    expect(query.where).toHaveBeenCalledOnce();
    expect(query.orderBy).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: 빈 목록 응답의 failing test를 작성한다**

```ts
it("returns an empty array when the user has no workspace memberships", async () => {
  mockWorkspaceListQuery([]);

  const response = await request(createApp())
    .get("/workspaces")
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ workspaces: [] });
});
```

- [ ] **Step 4: 인증 실패와 DB 오류의 failing test를 작성한다**

인증이 없는 요청은 `401`과 `UNAUTHORIZED`를 반환하고 DB를 호출하지 않아야 한다.

```ts
it("returns 401 when the request is not authenticated", async () => {
  const response = await request(createApp()).get("/workspaces");

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe("UNAUTHORIZED");
  expect(db.select).not.toHaveBeenCalled();
});
```

DB 쿼리의 마지막 `orderBy` Promise가 거부되면 기존 공통 에러 핸들러를 통해 `500`과 `INTERNAL_SERVER_ERROR`를 반환해야 한다.

```ts
it("returns 500 when listing workspaces fails", async () => {
  const query = mockWorkspaceListQuery([]);
  query.orderBy.mockRejectedValueOnce(new Error("workspace list failed"));

  const response = await request(createApp())
    .get("/workspaces")
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
});
```

- [ ] **Step 5: 테스트가 기능 부재로 실패하는지 확인한다**

Run: `pnpm --dir backend exec vitest run tests/workspace.test.ts`

Expected: 기존 `POST /workspaces` 테스트는 통과하고, 새 `GET /workspaces` 테스트는 라우트가 아직 없어 `404`로 실패한다. 테스트 코드 오류나 import 오류로 실패하면 먼저 테스트를 수정한 뒤 다시 실행한다.

---

### Task 2: 워크스페이스 목록 조회 API 구현

**Files:**
- Modify: `backend/src/services/workspace.service.ts`
- Modify: `backend/src/controllers/workspace.controller.ts`
- Modify: `backend/src/routes/workspace.routes.ts`
- Test: `backend/tests/workspace.test.ts` (Task 1에서 작성한 테스트)

**Interfaces:**
- Consumes: Task 1의 `GET /workspaces` 테스트 계약
- Produces: `listWorkspaces(userId: string): Promise<WorkspaceListItem[]>`, `listWorkspacesHandler`, `GET /workspaces`

- [ ] **Step 1: 목록 조회 서비스의 최소 구현을 작성한다**

`backend/src/services/workspace.service.ts`에 Drizzle의 `eq`, `asc`, `desc`를 추가하고 다음 타입과 함수를 구현한다.

```ts
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { workspaceMemberships, workspaces } from "@/db/schema";

export type WorkspaceListItem = typeof workspaces.$inferSelect & {
  role: (typeof workspaceMemberships.$inferSelect)["role"];
};

export async function listWorkspaces(userId: string): Promise<WorkspaceListItem[]> {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      isDefault: workspaces.isDefault,
      createdAt: workspaces.createdAt,
      role: workspaceMemberships.role,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(eq(workspaceMemberships.userId, userId))
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt), asc(workspaces.id));
}
```

이 쿼리는 멤버십을 기준으로 시작하므로 사용자의 소속 관계가 없는 워크스페이스를 반환하지 않는다. `innerJoin`과 `where`가 이 범위를 보장하며, 별도 애플리케이션 필터링은 추가하지 않는다.

- [ ] **Step 2: 목록 조회 컨트롤러를 추가한다**

`backend/src/controllers/workspace.controller.ts`에서 `listWorkspaces`를 import하고, 기존 생성 handler와 동일한 인증 방어선을 사용해 다음 handler를 추가한다.

```ts
export async function listWorkspacesHandler(req: Request, res: Response) {
  if (!req.user) {
    throw new HttpError(401, "UNAUTHORIZED", ERROR_MESSAGES.MISSING_BEARER_TOKEN);
  }

  const workspaces = await listWorkspaces(req.user.sub);
  res.status(200).json({ workspaces });
}
```

함수명 충돌을 피해야 하는 경우 서비스 import alias와 응답 변수명을 사용한다. 예를 들면 `listUserWorkspaces`와 `workspaceList`를 사용해도 되지만, 최종 외부 handler 이름은 `listWorkspacesHandler`로 유지한다.

- [ ] **Step 3: GET 라우트를 등록한다**

`backend/src/routes/workspace.routes.ts`에서 handler를 import하고 기존 POST 라우트와 같은 router에 다음 라우트를 추가한다.

```ts
workspaceRouter.get("/", authenticate, asyncHandler(listWorkspacesHandler));
```

`authenticate`를 handler보다 앞에 두어 비인증 요청이 서비스에 도달하지 않도록 한다. 기존 `POST /workspaces` 등록은 그대로 유지한다.

- [ ] **Step 4: focused test로 GREEN을 확인한다**

Run: `pnpm --dir backend exec vitest run tests/workspace.test.ts`

Expected: `GET /workspaces` 및 기존 `POST /workspaces` 테스트가 모두 통과한다. 목록 성공 테스트에서 200 응답과 role 포함 payload가 확인되고, 인증 실패·빈 목록·DB 오류 테스트도 통과해야 한다.

- [ ] **Step 5: 전체 품질 검증을 실행한다**

Run: `pnpm --dir backend test`

Expected: 전체 Vitest 테스트가 통과한다.

Run: `pnpm --dir backend lint`

Expected: ESLint 오류가 없다.

Run: `pnpm --dir backend build`

Expected: TypeScript 컴파일과 alias 처리가 성공한다.

Run: `pnpm --dir backend exec prettier --check src/services/workspace.service.ts src/controllers/workspace.controller.ts src/routes/workspace.routes.ts tests/workspace.test.ts`

Expected: 지정한 파일이 Prettier 형식과 일치한다.

Run: `git diff --check`

Expected: 공백 오류가 없다.

---

## 구현 전 계획 자체 점검

- 요구사항 범위: `PRODUCT.md`의 사용자 소속 워크스페이스 모델과 `DESIGN.md`의 Workspace Switcher 목록 표시를 `GET /workspaces` 및 `role` 필드로 모두 반영했다.
- 데이터 보안 범위: 멤버십 사용자 ID 조건과 내부 조인을 서비스 쿼리에 명시했다.
- 정렬 일관성: 기본 워크스페이스·생성일·ID 순서를 Global Constraints와 서비스 코드 예시에서 동일하게 정의했다.
- 테스트 범위: 성공, 인증 실패, 빈 결과, DB 오류와 기존 생성 기능 회귀를 계획했다.
- 스키마 범위: 이미 존재하는 `workspaces`와 `workspace_memberships` 테이블만 사용하며 migration task는 없다.
- Placeholder 검사: `TBD`, `TODO`, 미정 에러 처리, 미정 파일 경로를 포함하지 않았다.
- 사용자 규칙: 커밋·푸시·병합은 계획과 실행에서 제외한다.

## 실행 방식

이 계획은 `superpowers:subagent-driven-development`로 실행한다. Task 1은 failing test만 작성하는 fresh implementer가 수행하고, Task 1 리뷰가 통과한 후 Task 2를 별도 fresh implementer가 수행한다. 각 task 후에는 요구사항 준수와 코드 품질을 검토하며, 최종적으로 전체 테스트·lint·build를 다시 확인한다.
