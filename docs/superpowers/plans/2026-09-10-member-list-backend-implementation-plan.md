# 워크스페이스 멤버 목록 조회 백엔드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증된 워크스페이스 Owner와 Member가 이름 또는 이메일 검색과 페이지네이션으로 멤버 목록을 조회하는 `GET /workspaces/:workspaceId/members` API를 구현한다.

**Architecture:** 멤버 기능을 schema, service, controller, router로 분리하고 route index에 중첩 경로를 등록한다. 서비스는 요청자의 멤버십을 먼저 확인한 뒤 `workspace_memberships`와 `users`를 조인한 count 및 목록 쿼리를 동일 조건으로 실행하며, 기존 검색·페이지네이션 유틸리티를 재사용한다.

**Tech Stack:** Node.js 20+, TypeScript, Express 4, Drizzle ORM, PostgreSQL, Zod 4, Vitest 5, Supertest, pnpm

**Spec:** `docs/superpowers/specs/2026-09-10-member-list-backend-design.md`

## Global Constraints

- API 경로는 `GET /workspaces/:workspaceId/members`다.
- 인증은 기존 `authenticate`와 `requireUser`를 사용한다.
- Owner와 Member 모두 조회할 수 있고 비멤버는 `404 WORKSPACE_NOT_FOUND`를 받는다.
- `search`는 trim 후 최대 100자이며 이름 또는 이메일의 대소문자 무시 부분 일치다.
- `page` 기본값은 1, `limit` 기본값은 20이고 최대 100이다.
- 응답 항목은 `userId`, `name`, `email`, `role`, `joinedAt`만 포함한다.
- 정렬은 Owner 우선, 합류일 오름차순, 사용자 ID 오름차순이다.
- 검색 결과가 없거나 page가 범위를 초과해도 200과 빈 `members`를 반환한다.
- 기존 `listQuerySchema`, 검색 패턴 escape, 페이지네이션 유틸리티를 재사용한다.
- 데이터베이스 스키마와 마이그레이션, 기존 workspace/project API, 프론트엔드는 변경하지 않는다.
- production code 전에 실패 테스트를 작성하고 Red-Green-Refactor 순서를 지킨다.
- 사용자가 커밋을 요청하지 않았으므로 commit, push, merge, PR 생성은 실행하지 않는다.
- 구현 후 이 문서의 `Implementation Results`를 실제 변경과 검증 결과로 갱신한다.

---

### Task 0: 실행 전 격리와 기준 상태 확인

**Files:**
- Inspect: repository and `backend/package.json`
- Preserve: `docs/superpowers/specs/2026-09-10-member-list-backend-design.md`
- Preserve: `docs/superpowers/plans/2026-09-10-member-list-backend-implementation-plan.md`

**Interfaces:**
- Consumes: 현재 `feature/members` linked worktree와 기존 백엔드 검증 명령
- Produces: 기능 구현 전 기준 상태와 기존 실패 여부 기록

- [x] **Step 1: linked worktree와 브랜치를 확인한다**

Run:

```bash
git rev-parse --git-dir
git rev-parse --git-common-dir
git branch --show-current
```

Expected: git dir과 common dir이 달라 linked worktree이며 현재 브랜치는 `feature/members`다. 새 worktree나 브랜치를 만들지 않는다.

- [x] **Step 2: 기존 변경을 확인한다**

Run:

```bash
git status --short
```

Expected: 이번 작업에서 작성한 설계·계획 문서 외에 사용자 변경이 있으면 해당 파일을 기록하고 덮어쓰지 않는다.

- [x] **Step 3: 백엔드 기준 테스트를 실행한다**

Run:

```bash
pnpm --dir backend test
```

Expected: 기존 백엔드 테스트가 통과한다. 실패가 있으면 기능 실패와 구분해 `Implementation Results`에 기록하고 구현을 중단해 원인을 확인한다.

---

### Task 1: 멤버 path schema를 TDD로 추가

**Files:**
- Create: `backend/tests/member.test.ts`
- Create: `backend/src/schemas/member.schema.ts`

**Interfaces:**
- Consumes: `ERROR_MESSAGES.WORKSPACE_ID_INVALID`, Zod 4
- Produces: `memberParamsSchema: z.ZodObject<{ workspaceId: z.ZodUUID }>`

- [x] **Step 1: UUID path 검증 실패 테스트를 작성한다**

`backend/tests/member.test.ts`를 만들고 유효한 UUID와 잘못된 값을 구분하는 계약을 작성한다.

```ts
import { describe, expect, it } from "vitest";
import { memberParamsSchema } from "@/schemas/member.schema";

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";

describe("memberParamsSchema", () => {
  it("워크스페이스 UUID를 검증한다", () => {
    expect(memberParamsSchema.parse({ workspaceId })).toEqual({ workspaceId });
    expect(() => memberParamsSchema.parse({ workspaceId: "not-a-uuid" })).toThrow();
  });
});
```

- [x] **Step 2: 테스트가 기능 부재로 실패하는지 확인한다**

Run:

```bash
pnpm --dir backend exec vitest run tests/member.test.ts
```

Expected: `@/schemas/member.schema`가 없어서 FAIL한다. 테스트 문법이나 환경 설정 오류라면 테스트를 먼저 바로잡는다.

- [x] **Step 3: 최소 schema를 구현한다**

`backend/src/schemas/member.schema.ts`를 추가한다.

```ts
import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

export const memberParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
});
```

- [x] **Step 4: focused test를 GREEN으로 확인한다**

Run:

```bash
pnpm --dir backend exec vitest run tests/member.test.ts
```

Expected: schema 테스트가 PASS한다.

---

### Task 2: 멤버 목록 서비스를 TDD로 구현

**Files:**
- Modify: `backend/tests/member.test.ts`
- Create: `backend/src/services/member.service.ts`

**Interfaces:**
- Consumes: `workspaceMemberships`, `users`, `buildContainsSearchPattern`, `getPaginationOffset`, `createPaginationMeta`
- Produces: `listMembers(input: ListMembersInput): Promise<ListMembersResult>`
- Produces: `MemberListItem`, `ListMembersInput`, `ListMembersResult`

- [x] **Step 1: DB mock과 목록 query helper를 추가한다**

`backend/tests/member.test.ts`의 import와 setup을 다음처럼 확장한다. `vi.mock`은 Vitest가 hoist하므로 production module import보다 아래에 있어도 DB client를 대체한다.

```ts
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import { users, workspaceMemberships } from "@/db/schema";
import { memberParamsSchema } from "@/schemas/member.schema";
import { listMembers } from "@/services/member.service";

vi.mock("@/db/client", () => ({
  db: { select: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(db.select).mockReset();
});

function mockMemberListQueries({
  membershipRows = [{ id: "membership-1" }],
  countRows = [{ total: 2 }],
  memberRows = [],
  membershipError,
  countError,
  memberError,
}: {
  membershipRows?: unknown[];
  countRows?: unknown[];
  memberRows?: unknown[];
  membershipError?: Error;
  countError?: Error;
  memberError?: Error;
} = {}) {
  const membershipQuery = {
    from: vi.fn().mockReturnThis(),
    where: membershipError
      ? vi.fn().mockRejectedValue(membershipError)
      : vi.fn().mockResolvedValue(membershipRows),
  };
  const countQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: countError
      ? vi.fn().mockRejectedValue(countError)
      : vi.fn().mockResolvedValue(countRows),
  };
  const memberQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: memberError
      ? vi.fn().mockRejectedValue(memberError)
      : vi.fn().mockResolvedValue(memberRows),
  };

  vi.mocked(db.select)
    .mockReturnValueOnce(membershipQuery as never)
    .mockReturnValueOnce(countQuery as never)
    .mockReturnValueOnce(memberQuery as never);

  return { membershipQuery, countQuery, memberQuery };
}
```

- [x] **Step 2: 성공·검색·페이지네이션 실패 테스트를 작성한다**

동일 파일에 service describe를 추가한다.

```ts
describe("listMembers", () => {
  it("이름 또는 이메일 검색 조건으로 멤버와 페이지 정보를 반환한다", async () => {
    const joinedAt = new Date("2026-09-10T00:00:00.000Z");
    const { membershipQuery, countQuery, memberQuery } = mockMemberListQueries({
      countRows: [{ total: 5 }],
      memberRows: [
        {
          userId: "user-owner",
          name: "Kim Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt,
        },
      ],
    });

    await expect(
      listMembers({
        workspaceId,
        requesterId: "user-1",
        search: "Kim",
        page: 2,
        limit: 2,
      }),
    ).resolves.toEqual({
      members: [
        {
          userId: "user-owner",
          name: "Kim Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt,
        },
      ],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });

    expect(db.select).toHaveBeenNthCalledWith(1, { id: workspaceMemberships.id });
    expect(db.select).toHaveBeenNthCalledWith(2, { total: count() });
    expect(db.select).toHaveBeenNthCalledWith(3, {
      userId: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMemberships.role,
      joinedAt: workspaceMemberships.createdAt,
    });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );

    const searchCondition = and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      or(ilike(users.name, "%Kim%"), ilike(users.email, "%Kim%")),
    );
    expect(countQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(countQuery.innerJoin).toHaveBeenCalledWith(
      users,
      eq(workspaceMemberships.userId, users.id),
    );
    expect(countQuery.where).toHaveBeenCalledWith(searchCondition);
    expect(memberQuery.where).toHaveBeenCalledWith(searchCondition);
    expect(memberQuery.orderBy).toHaveBeenCalledWith(
      sql<number>`case when ${workspaceMemberships.role} = 'owner' then 0 else 1 end`,
      asc(workspaceMemberships.createdAt),
      asc(users.id),
    );
    expect(memberQuery.limit).toHaveBeenCalledWith(2);
    expect(memberQuery.offset).toHaveBeenCalledWith(2);
  });

  it("LIKE 와일드카드와 백슬래시를 이름과 이메일 검색에서 escape한다", async () => {
    const { countQuery, memberQuery } = mockMemberListQueries({
      countRows: [{ total: 0 }],
      memberRows: [],
    });

    await listMembers({
      workspaceId,
      requesterId: "user-1",
      search: "100%_done\\now",
      page: 1,
      limit: 20,
    });

    const escapedCondition = and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      or(
        ilike(users.name, "%100\\%\\_done\\\\now%"),
        ilike(users.email, "%100\\%\\_done\\\\now%"),
      ),
    );
    expect(countQuery.where).toHaveBeenCalledWith(escapedCondition);
    expect(memberQuery.where).toHaveBeenCalledWith(escapedCondition);
  });

  it("검색 결과가 없거나 page가 범위를 초과하면 빈 목록과 실제 pagination을 반환한다", async () => {
    mockMemberListQueries({ countRows: [{ total: 5 }], memberRows: [] });

    await expect(
      listMembers({
        workspaceId,
        requesterId: "user-1",
        page: 4,
        limit: 2,
      }),
    ).resolves.toEqual({
      members: [],
      pagination: { page: 4, limit: 2, total: 5, totalPages: 3 },
    });
  });
});
```

- [x] **Step 3: 권한과 DB 오류 실패 테스트를 작성한다**

```ts
it("비멤버는 404이며 count와 목록 조회를 시작하지 않는다", async () => {
  const { countQuery, memberQuery } = mockMemberListQueries({ membershipRows: [] });

  await expect(
    listMembers({ workspaceId, requesterId: "outsider", page: 1, limit: 20 }),
  ).rejects.toMatchObject({ status: 404, code: "WORKSPACE_NOT_FOUND" });
  expect(db.select).toHaveBeenCalledOnce();
  expect(countQuery.where).not.toHaveBeenCalled();
  expect(memberQuery.where).not.toHaveBeenCalled();
});

it.each([
  { label: "멤버십", options: { membershipError: new Error("membership failed") } },
  { label: "개수", options: { countError: new Error("count failed") } },
  { label: "목록", options: { memberError: new Error("members failed") } },
])("$label DB 오류를 전파한다", async ({ options }) => {
  mockMemberListQueries(options);

  await expect(
    listMembers({ workspaceId, requesterId: "user-1", page: 1, limit: 20 }),
  ).rejects.toThrow();
});
```

- [x] **Step 4: 서비스 테스트가 기능 부재로 실패하는지 확인한다**

Run:

```bash
pnpm --dir backend exec vitest run tests/member.test.ts
```

Expected: `@/services/member.service`가 없거나 `listMembers`가 없어 FAIL한다. DB mock이나 test setup 자체의 오류는 먼저 수정한다.

- [x] **Step 5: 목록 서비스의 최소 구현을 작성한다**

`backend/src/services/member.service.ts`를 추가한다.

```ts
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaceMemberships } from "@/db/schema";
import { ERROR_MESSAGES } from "@/constants/messages";
import { HttpError } from "@/utils/http-error";
import type { PaginationMeta } from "@/utils/pagination";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { buildContainsSearchPattern } from "@/utils/search";

export interface ListMembersInput {
  workspaceId: string;
  requesterId: string;
  search?: string;
  page: number;
  limit: number;
}

export interface MemberListItem {
  userId: string;
  name: string;
  email: string;
  role: (typeof workspaceMemberships.$inferSelect)["role"];
  joinedAt: Date;
}

export interface ListMembersResult {
  members: MemberListItem[];
  pagination: PaginationMeta;
}

export async function listMembers({
  workspaceId,
  requesterId,
  search,
  page,
  limit,
}: ListMembersInput): Promise<ListMembersResult> {
  const [requesterMembership] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, requesterId),
      ),
    );

  if (!requesterMembership) {
    throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
  }

  const pattern = search ? buildContainsSearchPattern(search) : undefined;
  const whereCondition = and(
    eq(workspaceMemberships.workspaceId, workspaceId),
    pattern ? or(ilike(users.name, pattern), ilike(users.email, pattern)) : undefined,
  );
  const ownerFirst = sql<number>`case when ${workspaceMemberships.role} = 'owner' then 0 else 1 end`;

  const [countRows, memberRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(whereCondition),
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: workspaceMemberships.role,
        joinedAt: workspaceMemberships.createdAt,
      })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(whereCondition)
      .orderBy(ownerFirst, asc(workspaceMemberships.createdAt), asc(users.id))
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return {
    members: memberRows,
    pagination: createPaginationMeta({ page, limit, total }),
  };
}
```

- [x] **Step 6: service focused test를 GREEN으로 확인한다**

Run:

```bash
pnpm --dir backend exec vitest run tests/member.test.ts
```

Expected: schema와 service 테스트가 모두 PASS한다.

- [x] **Step 7: 테스트와 서비스 코드를 작게 리팩터링한다**

중복 검색 조건이나 mock setup만 정리한다. 공개 타입과 API 계약은 바꾸지 않는다.

- [x] **Step 8: 리팩터링 후 GREEN을 재확인한다**

Run:

```bash
pnpm --dir backend exec vitest run tests/member.test.ts
```

Expected: 모든 focused test가 계속 PASS한다.

---

### Task 3: HTTP controller와 router를 TDD로 연결

**Files:**
- Modify: `backend/tests/member.test.ts`
- Create: `backend/src/controllers/member.controller.ts`
- Create: `backend/src/routes/member.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: `memberParamsSchema`, `listQuerySchema`, `listMembers`, `authenticate`, `requireUser`, `asyncHandler`
- Produces: `listMembersHandler(req: Request, res: Response): Promise<void>`
- Produces: 인증된 `GET /workspaces/:workspaceId/members`

- [x] **Step 1: HTTP 성공과 기본 query 실패 테스트를 작성한다**

`backend/tests/member.test.ts`에 `supertest`, app, JWT import를 추가한다.

```ts
import request from "supertest";
import { createApp } from "@/app";
import { signAccessToken } from "@/lib/jwt";

async function createAccessToken(sub = "user-1") {
  return signAccessToken({
    sub,
    email: sub + "@example.com",
    sid: "session-1",
  });
}
```

HTTP describe에 성공 응답과 query 기본값을 추가한다.

```ts
describe("GET /workspaces/:workspaceId/members", () => {
  it("인증된 Member에게 직렬화된 멤버 목록을 반환한다", async () => {
    const joinedAt = new Date("2026-09-10T00:00:00.000Z");
    mockMemberListQueries({
      membershipRows: [{ id: "requester-membership", role: "member" }],
      countRows: [{ total: 2 }],
      memberRows: [
        {
          userId: "owner-1",
          name: "Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt,
        },
        {
          userId: "user-1",
          name: "Member",
          email: "member@example.com",
          role: "member",
          joinedAt,
        },
      ],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/members`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      members: [
        {
          userId: "owner-1",
          name: "Owner",
          email: "owner@example.com",
          role: "owner",
          joinedAt: joinedAt.toISOString(),
        },
        {
          userId: "user-1",
          name: "Member",
          email: "member@example.com",
          role: "member",
          joinedAt: joinedAt.toISOString(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });
  });

  it("검색어를 trim하고 명시한 page와 limit를 적용한다", async () => {
    const { countQuery, memberQuery } = mockMemberListQueries({
      countRows: [{ total: 5 }],
      memberRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/members`)
      .query({ search: "  Kim  ", page: "2", limit: "2" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    const searchCondition = and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      or(ilike(users.name, "%Kim%"), ilike(users.email, "%Kim%")),
    );
    expect(countQuery.where).toHaveBeenCalledWith(searchCondition);
    expect(memberQuery.where).toHaveBeenCalledWith(searchCondition);
    expect(memberQuery.limit).toHaveBeenCalledWith(2);
    expect(memberQuery.offset).toHaveBeenCalledWith(2);
  });
});
```

- [x] **Step 2: HTTP 인증·입력·권한·오류 실패 테스트를 작성한다**

```ts
it("인증이 없으면 401이며 DB를 조회하지 않는다", async () => {
  const response = await request(createApp()).get(`/workspaces/${workspaceId}/members`);

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe("UNAUTHORIZED");
  expect(db.select).not.toHaveBeenCalled();
});

it("유효하지 않은 Access Token이면 401이며 DB를 조회하지 않는다", async () => {
  const response = await request(createApp())
    .get(`/workspaces/${workspaceId}/members`)
    .set("Authorization", "Bearer invalid-token");

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe("UNAUTHORIZED");
  expect(db.select).not.toHaveBeenCalled();
});

it.each([
  { pathWorkspaceId: "not-a-uuid", query: {} },
  { pathWorkspaceId: workspaceId, query: { page: "0" } },
  { pathWorkspaceId: workspaceId, query: { limit: "101" } },
  { pathWorkspaceId: workspaceId, query: { search: "a".repeat(101) } },
])("잘못된 path 또는 query는 400이며 DB를 조회하지 않는다", async ({ pathWorkspaceId, query }) => {
  const response = await request(createApp())
    .get(`/workspaces/${pathWorkspaceId}/members`)
    .query(query)
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe("VALIDATION_ERROR");
  expect(db.select).not.toHaveBeenCalled();
});

it("비멤버에게 404를 반환한다", async () => {
  mockMemberListQueries({ membershipRows: [] });

  const response = await request(createApp())
    .get(`/workspaces/${workspaceId}/members`)
    .set("Authorization", `Bearer ${await createAccessToken("outsider")}`);

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
});

it("DB 오류를 공통 500 응답으로 변환한다", async () => {
  mockMemberListQueries({ memberError: new Error("members failed") });

  const response = await request(createApp())
    .get(`/workspaces/${workspaceId}/members`)
    .set("Authorization", `Bearer ${await createAccessToken()}`);

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
});
```

- [x] **Step 3: HTTP 테스트가 라우트 부재로 실패하는지 확인한다**

Run:

```bash
pnpm --dir backend exec vitest run tests/member.test.ts
```

Expected: service 직접 테스트는 PASS하고 HTTP 테스트는 현재 라우트가 없어 404로 FAIL한다.

- [x] **Step 4: controller를 구현한다**

`backend/src/controllers/member.controller.ts`를 추가한다.

```ts
import type { Request, Response } from "express";
import { listQuerySchema } from "@/schemas/list-query.schema";
import { memberParamsSchema } from "@/schemas/member.schema";
import { listMembers } from "@/services/member.service";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireUser } from "@/utils/require-user";

export async function listMembersHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId } = parseOrThrow(memberParamsSchema, req.params);
  const { search, page, limit } = parseOrThrow(listQuerySchema, req.query);

  const result = await listMembers({
    workspaceId,
    requesterId: user.sub,
    search,
    page,
    limit,
  });

  res.status(200).json(result);
}
```

- [x] **Step 5: member router를 구현한다**

`backend/src/routes/member.routes.ts`를 추가한다.

```ts
import { Router } from "express";
import { listMembersHandler } from "@/controllers/member.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const memberRouter = Router({ mergeParams: true });

memberRouter.get("/", authenticate, asyncHandler(listMembersHandler));
```

- [x] **Step 6: route index에 구체 경로를 먼저 등록한다**

`backend/src/routes/index.ts`에서 `memberRouter`를 import하고 일반 workspace router보다 앞에 마운트한다.

```ts
import { memberRouter } from "@/routes/member.routes";

router.use("/workspaces/:workspaceId/projects", projectRouter);
router.use("/workspaces/:workspaceId/members", memberRouter);
router.use("/workspaces", workspaceRouter);
```

기존 health, auth, project, workspace 라우트의 상대 순서와 동작은 유지한다.

- [x] **Step 7: HTTP focused test를 GREEN으로 확인한다**

Run:

```bash
pnpm --dir backend exec vitest run tests/member.test.ts
```

Expected: schema, service, HTTP 테스트가 모두 PASS한다.

- [x] **Step 8: 멤버 테스트 전체 계약을 점검한다**

다음 검증이 각각 명시적으로 존재하는지 확인한다.

```text
Owner 행과 Member 행 응답
Member 요청자의 조회 허용
userId/name/email/role/joinedAt 최소 선택
이름 또는 이메일 검색 및 검색문자 escape
Owner 우선/합류일/사용자 ID 정렬
기본 query와 범위 초과 page
401/400/404/500
비멤버의 count/list 차단
```

누락된 계약이 있으면 해당 실패 테스트를 먼저 추가하고 FAIL을 확인한 뒤 최소 구현으로 GREEN을 회복한다.

---

### Task 4: 전체 검증과 구현 결과 기록

**Files:**
- Verify: `backend/src/schemas/member.schema.ts`
- Verify: `backend/src/services/member.service.ts`
- Verify: `backend/src/controllers/member.controller.ts`
- Verify: `backend/src/routes/member.routes.ts`
- Verify: `backend/src/routes/index.ts`
- Verify: `backend/tests/member.test.ts`
- Modify: `docs/superpowers/plans/2026-09-10-member-list-backend-implementation-plan.md`

**Interfaces:**
- Consumes: Task 1~3의 구현과 테스트
- Produces: 검증된 백엔드 기능과 실제 실행 결과가 기록된 계획 문서

- [x] **Step 1: focused test를 실행한다**

Run:

```bash
pnpm --dir backend exec vitest run tests/member.test.ts
```

Expected: 모든 member 테스트가 PASS한다.

- [x] **Step 2: 전체 백엔드 테스트를 실행한다**

Run:

```bash
pnpm --dir backend test
```

Expected: 기존 테스트를 포함한 전체 Vitest suite가 PASS한다.

- [x] **Step 3: lint와 build를 실행한다**

Run:

```bash
pnpm --dir backend lint
pnpm --dir backend build
```

Expected: ESLint 오류가 없고 TypeScript compile 및 alias 변환이 성공한다.

- [x] **Step 4: 변경 파일 formatting을 검사한다**

Run:

```bash
pnpm --dir backend exec prettier --check \
  src/schemas/member.schema.ts \
  src/services/member.service.ts \
  src/controllers/member.controller.ts \
  src/routes/member.routes.ts \
  src/routes/index.ts \
  tests/member.test.ts
```

Expected: 지정한 파일이 모두 Prettier 형식과 일치한다. 실패하면 `prettier --write`를 지정 파일에만 실행한 후 Step 1~4를 다시 확인한다.

- [x] **Step 5: diff와 작업 범위를 확인한다**

Run:

```bash
git diff --check
git status --short
git diff -- backend docs/superpowers
```

Expected: unrelated change, schema/migration/frontend 변경, whitespace 오류가 없다. 기존 사용자 변경이 있으면 이번 변경과 분리해 보고한다.

- [x] **Step 6: Implementation Results를 실제 결과로 갱신한다**

이 문서 하단에 다음 내용을 구체적인 파일명, 명령, 통과 건수와 함께 기록한다.

```text
실제 변경 내용
계획과 달라진 점
실행한 검증 명령과 결과
남은 후속 작업
```

문서 갱신 후 `git diff --check`를 다시 실행한다.

## Implementation Results

- 상태: 구현 및 검증 완료
- 실제 변경 내용:
  - `memberParamsSchema`와 `listMembers` 서비스를 추가해 워크스페이스 멤버 목록 조회, 검색, 페이지네이션, 멤버십 권한 검사를 구현함.
  - `GET /workspaces/:workspaceId/members` 컨트롤러·라우터를 추가하고 인증 미들웨어 및 기존 라우터에 등록함.
  - 소유자 우선·가입일·사용자 ID 기준 정렬, 이름·이메일 부분 검색, 검색어 와일드카드 이스케이프, 페이지 메타데이터 응답을 구현함.
  - 스키마·서비스·HTTP 계층 테스트 19개를 추가함.
  - 설계 문서와 구현 계획 문서를 작성하고 실제 결과를 반영함.
- 계획과 달라진 점:
  - 사용자 지침에 따라 커밋은 생성하지 않았으며, 커밋 대신 작업 트리 diff와 단계별 리뷰 기록으로 검증함.
  - Task 4 검증 작업을 시도한 작업 에이전트가 워크스페이스 크레딧 부족으로 종료되어, 동일 검증을 컨트롤러가 직접 수행함.
  - 최초 기준선 전체 테스트에서 기존 `project.test.ts`의 일시적인 `ECONNRESET`이 발생했으나 해당 테스트를 재실행하고 전체 테스트를 재실행해 통과를 확인함. 기능 코드 변경은 없음.
  - 최종 리뷰에서 제안된 Owner 조회 회귀 테스트를 추가해 계획의 권한 계약 검증을 보강함.
- 실행한 검증 명령과 결과:
  - `pnpm --dir backend exec vitest run tests/member.test.ts --reporter=dot --silent` — 1개 파일, 19개 테스트 통과.
  - `pnpm --dir backend test -- --reporter=dot --silent` — 21개 파일, 202개 테스트 통과.
  - `pnpm --dir backend lint` — 통과.
  - `pnpm --dir backend build` — 통과.
  - `pnpm --dir backend exec prettier --check src/schemas/member.schema.ts src/services/member.service.ts src/controllers/member.controller.ts src/routes/member.routes.ts src/routes/index.ts tests/member.test.ts` — 통과.
  - `git diff --check` — 통과.
  - `git status --short` — 기능 코드·테스트·설계·계획 문서 외 unrelated 변경 없음.
- 남은 후속 작업: 없음. 실제 데이터베이스를 연결한 환경별 E2E 검증은 배포 환경 검증 범위에서 수행한다.
