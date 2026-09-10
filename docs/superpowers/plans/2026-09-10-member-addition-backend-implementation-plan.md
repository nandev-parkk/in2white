# 워크스페이스 멤버 추가 백엔드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인증된 워크스페이스 Owner가 기존 사용자를 `member` 역할로 즉시 추가하는 `POST /workspaces/:workspaceId/members` API를 구현한다.

**Architecture:** 기존 `memberRouter`와 멤버 모듈을 확장한다. `member.service.ts`의 `addMember`는 하나의 Drizzle transaction 안에서 요청자의 Owner 권한, 대상 사용자, 중복 멤버십을 확인하고 멤버십을 생성한다. PostgreSQL unique constraint 오류는 `409 MEMBER_ALREADY_EXISTS`로 변환한다.

**Tech Stack:** Node.js 20+, TypeScript, Express 4, Drizzle ORM, PostgreSQL, Zod 4, Vitest 5, Supertest, pnpm

**Spec:** `docs/superpowers/specs/2026-09-10-member-addition-backend-design.md`

## Global Constraints

- API 경로는 `POST /workspaces/:workspaceId/members`다.
- 요청 본문은 UUID 형식의 `{ "userId": "..." }`만 허용한다.
- 인증은 기존 `authenticate`와 `requireUser`를 사용한다.
- Owner만 멤버를 추가할 수 있고 일반 Member는 `403 MEMBER_ADD_FORBIDDEN`을 받는다.
- 비멤버 요청자는 `404 WORKSPACE_NOT_FOUND`를 받는다.
- 대상 사용자가 없으면 `404 USER_NOT_FOUND`를 반환한다.
- 이미 멤버이거나 unique constraint가 충돌하면 `409 MEMBER_ALREADY_EXISTS`를 반환한다.
- 성공 응답은 `201 { member: { userId, name, email, role, joinedAt } }`다.
- `workspace_memberships`의 기존 `(workspace_id, user_id)` unique constraint를 재사용하며 스키마·마이그레이션은 변경하지 않는다.
- 전체 사용자 검색/목록, 초대 이메일, 수락 절차, 멤버 내보내기는 구현하지 않는다.
- 관련 테스트를 먼저 작성하고 Red-Green-Refactor 순서를 지킨다.
- 사용자가 별도로 요청하기 전까지 commit, push, merge, PR을 실행하지 않는다.

---

## 파일 구조와 책임

- Modify: `backend/src/constants/messages.ts`
  - 사용자 없음, 멤버 중복, Owner 전용 권한 오류 메시지를 제공한다.
- Modify: `backend/src/schemas/member.schema.ts`
  - `workspaceId` path schema와 `userId` body schema를 제공한다.
- Modify: `backend/src/services/member.service.ts`
  - 기존 목록 조회와 `addMember` transaction을 제공한다.
- Modify: `backend/src/controllers/member.controller.ts`
  - POST 요청의 인증·path·body를 검증하고 201 응답을 만든다.
- Modify: `backend/src/routes/member.routes.ts`
  - 인증된 POST route를 등록한다.
- Modify: `backend/tests/member.test.ts`
  - schema, service, HTTP 계약과 오류 경계를 검증한다.
- Create: `docs/superpowers/specs/2026-09-10-member-addition-backend-design.md`
  - 승인된 설계와 공개 계약을 기록한다.
- Create: `docs/superpowers/plans/2026-09-10-member-addition-backend-implementation-plan.md`
  - 이 구현 계획과 최종 결과를 기록한다.

서비스가 이후 컨트롤러가 사용할 인터페이스는 다음과 같다.

```ts
export interface AddMemberInput {
  workspaceId: string;
  requesterId: string;
  userId: string;
}

export async function addMember(input: AddMemberInput): Promise<MemberListItem>;
```

`MemberListItem`은 기존 멤버 목록 서비스의 `userId`, `name`, `email`, `role`, `joinedAt` 타입을 재사용한다.

## Task 0: 실행 전 격리와 기준 상태 확인

**Files:**

- Inspect: Git worktree, 현재 브랜치, 백엔드 package scripts
- Preserve: 기존 `feature/members` 커밋과 현재 설계 문서

**Interfaces:**

- Consumes: 현재 linked worktree와 `backend/package.json`의 검증 명령
- Produces: 구현 전 기준 상태와 기존 테스트 결과

- [x] **Step 1: linked worktree와 브랜치를 확인한다**

  Run:

  ```bash
  git rev-parse --git-dir
  git rev-parse --git-common-dir
  git branch --show-current
  git status --short
  ```

  Expected: git dir과 common dir이 다른 linked worktree이고 현재 브랜치는 `feature/members`다. 작업 트리에는 설계·계획 문서 외 기존 변경이 없어야 하며, 다른 변경이 있으면 파일을 보존하고 이 작업과 섞지 않는다.

- [x] **Step 2: 기준 백엔드 테스트를 실행한다**

  Run:

  ```bash
  pnpm --dir backend test -- --reporter=dot --silent
  ```

  Expected: 구현 전 기존 테스트가 통과한다. 실패하면 기능 코드에 대한 실패로 해석하지 않고 원인과 테스트 결과를 계획의 최종 결과에 기록한다.

## Task 1: 입력 schema와 오류 메시지를 TDD로 추가한다

**Files:**

- Modify: `backend/src/constants/messages.ts`
- Modify: `backend/src/schemas/member.schema.ts`
- Test: `backend/tests/member.test.ts`

**Interfaces:**

- Consumes: 기존 `ERROR_MESSAGES.WORKSPACE_ID_INVALID`, Zod 4
- Produces: `addMemberBodySchema: z.ZodObject<{ userId: z.ZodUUID }>`

- [x] **Step 1: 실패하는 body schema 테스트를 작성한다**

  `backend/tests/member.test.ts`에 다음 계약을 추가한다.

  ```ts
  import {
    addMemberBodySchema,
    memberParamsSchema,
  } from "@/schemas/member.schema";

  const userId = "550e8400-e29b-41d4-a716-446655440001";

  describe("addMemberBodySchema", () => {
    it("userId UUID를 허용한다", () => {
      expect(addMemberBodySchema.parse({ userId })).toEqual({ userId });
    });

    it("userId가 없거나 UUID가 아니면 거부한다", () => {
      expect(() => addMemberBodySchema.parse({})).toThrow();
      expect(() =>
        addMemberBodySchema.parse({ userId: "not-a-uuid" }),
      ).toThrow();
    });

    it("userId 외의 body 필드를 거부한다", () => {
      expect(() =>
        addMemberBodySchema.parse({ userId, role: "owner" }),
      ).toThrow();
    });
  });
  ```

- [x] **Step 2: focused schema 테스트가 기능 부재로 실패하는지 확인한다**

  Run:

  ```bash
  pnpm --dir backend exec vitest run tests/member.test.ts -t addMemberBodySchema
  ```

  Expected: `addMemberBodySchema` export가 없어 실패한다. 기존 `memberParamsSchema` 테스트까지 깨지면 테스트 import 또는 기존 schema를 먼저 바로잡는다.

- [x] **Step 3: 오류 메시지와 최소 schema를 구현한다**

  `ERROR_MESSAGES`에 다음 항목을 추가한다.

  ```ts
  USER_ID_INVALID: "유효하지 않은 사용자 ID입니다",
  USER_NOT_FOUND: "사용자를 찾을 수 없습니다",
  MEMBER_ADD_FORBIDDEN: "멤버를 추가할 권한이 없습니다",
  MEMBER_ALREADY_EXISTS: "이미 워크스페이스 멤버입니다",
  ```

  `backend/src/schemas/member.schema.ts`에 다음 schema를 추가한다.

  ```ts
  export const addMemberBodySchema = z
    .object({
      userId: z.uuid({ error: ERROR_MESSAGES.USER_ID_INVALID }),
    })
    .strict();
  ```

- [x] **Step 4: schema 테스트를 GREEN으로 확인한다**

  Run:

  ```bash
  pnpm --dir backend exec vitest run tests/member.test.ts -t addMemberBodySchema
  ```

  Expected: 새 body schema 테스트가 통과한다.

## Task 2: `addMember` service를 transaction 기반 TDD로 구현한다

**Files:**

- Modify: `backend/tests/member.test.ts`
- Modify: `backend/src/services/member.service.ts`

**Interfaces:**

- Consumes: `users`, `workspaceMemberships`, `HttpError`, 기존 `MemberListItem`
- Produces: `AddMemberInput`, `addMember(input): Promise<MemberListItem>`

- [x] **Step 1: transaction mock과 성공 테스트를 추가한다**

  `vi.mock("@/db/client")`의 `db` mock에 `transaction: vi.fn()`을 추가하고 `beforeEach`에서 초기화한다. 다음과 같은 query helper를 테스트 파일에 추가한다.

  ```ts
  const targetUserId = "550e8400-e29b-41d4-a716-446655440001";

  function mockAddMemberTransaction({
    requesterRows = [{ role: "owner" }],
    userRows = [
      { id: targetUserId, name: "Kim Member", email: "member@example.com" },
    ],
    existingRows = [],
    membershipRows = [
      {
        role: "member",
        joinedAt: new Date("2026-09-10T00:00:00.000Z"),
      },
    ],
    requesterError,
    userError,
    existingError,
    insertError,
  }: {
    requesterRows?: unknown[];
    userRows?: unknown[];
    existingRows?: unknown[];
    membershipRows?: unknown[];
    requesterError?: Error;
    userError?: Error;
    existingError?: Error;
    insertError?: Error;
  } = {}) {
    const requesterQuery = {
      from: vi.fn().mockReturnThis(),
      where: requesterError
        ? vi.fn().mockRejectedValue(requesterError)
        : vi.fn().mockResolvedValue(requesterRows),
    };
    const userQuery = {
      from: vi.fn().mockReturnThis(),
      where: userError
        ? vi.fn().mockRejectedValue(userError)
        : vi.fn().mockResolvedValue(userRows),
    };
    const existingQuery = {
      from: vi.fn().mockReturnThis(),
      where: existingError
        ? vi.fn().mockRejectedValue(existingError)
        : vi.fn().mockResolvedValue(existingRows),
    };
    const membershipInsert = {
      values: vi.fn().mockReturnThis(),
      returning: insertError
        ? vi.fn().mockRejectedValue(insertError)
        : vi.fn().mockResolvedValue(membershipRows),
    };
    const transaction = {
      select: vi
        .fn()
        .mockReturnValueOnce(requesterQuery)
        .mockReturnValueOnce(userQuery)
        .mockReturnValueOnce(existingQuery),
      insert: vi.fn().mockReturnValue(membershipInsert),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );

    return {
      requesterQuery,
      userQuery,
      existingQuery,
      membershipInsert,
      transaction,
    };
  }
  ```

  `targetUserId`는 유효한 UUID 상수로 선언한다. 성공 테스트는 `addMember({ workspaceId, requesterId: "owner-1", userId: targetUserId })`가 응답 항목을 반환하고, 세 번의 select 조건과 insert values `{ workspaceId, userId: targetUserId, role: "member" }`를 검증하도록 작성한다.

- [x] **Step 2: 성공 테스트가 export 부재로 실패하는지 확인한다**

  Run:

  ```bash
  pnpm --dir backend exec vitest run tests/member.test.ts -t "Owner가 사용자를 멤버로 추가"
  ```

  Expected: `addMember` export 또는 구현이 없어 실패한다.

- [x] **Step 3: 권한·대상·중복·DB 오류 테스트를 추가한다**

  `listMembers` describe와 분리된 `describe("addMember", ...)`에 다음 케이스를 추가한다.

  ```text
  requesterRows: []                 -> 404 WORKSPACE_NOT_FOUND, target 조회/insert 없음
  requesterRows: [{ role: "member" }] -> 403 MEMBER_ADD_FORBIDDEN, insert 없음
  userRows: []                      -> 404 USER_NOT_FOUND, 기존 멤버/insert 없음
  existingRows: [{ id: "membership-1" }] -> 409 MEMBER_ALREADY_EXISTS, insert 없음
  insertError: { code: "23505" }    -> 409 MEMBER_ALREADY_EXISTS
  requesterError/userError/existingError/일반 insertError -> 원본 오류 전파
  ```

  unique 오류 mock은 `new Error`에 `code = "23505"`를 부여한 객체를 사용해 PostgreSQL 오류 변환 계약을 직접 검증한다.

- [x] **Step 4: 최소 service 구현으로 성공·오류 테스트를 GREEN으로 만든다**

  `backend/src/services/member.service.ts`에 다음 흐름을 구현한다.

  ```ts
  export interface AddMemberInput {
    workspaceId: string;
    requesterId: string;
    userId: string;
  }

  function isUniqueViolation(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    );
  }

  export async function addMember({
    workspaceId,
    requesterId,
    userId,
  }: AddMemberInput) {
    return db.transaction(async (tx) => {
      const [requesterMembership] = await tx
        .select({ role: workspaceMemberships.role })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, workspaceId),
            eq(workspaceMemberships.userId, requesterId),
          ),
        );

      if (!requesterMembership) {
        throw new HttpError(
          404,
          "WORKSPACE_NOT_FOUND",
          ERROR_MESSAGES.WORKSPACE_NOT_FOUND,
        );
      }

      if (requesterMembership.role !== "owner") {
        throw new HttpError(
          403,
          "MEMBER_ADD_FORBIDDEN",
          ERROR_MESSAGES.MEMBER_ADD_FORBIDDEN,
        );
      }

      const [targetUser] = await tx
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, userId));

      if (!targetUser) {
        throw new HttpError(
          404,
          "USER_NOT_FOUND",
          ERROR_MESSAGES.USER_NOT_FOUND,
        );
      }

      const [existingMembership] = await tx
        .select({ id: workspaceMemberships.id })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, workspaceId),
            eq(workspaceMemberships.userId, userId),
          ),
        );

      if (existingMembership) {
        throw new HttpError(
          409,
          "MEMBER_ALREADY_EXISTS",
          ERROR_MESSAGES.MEMBER_ALREADY_EXISTS,
        );
      }

      try {
        const [membership] = await tx
          .insert(workspaceMemberships)
          .values({ workspaceId, userId, role: "member" })
          .returning({
            role: workspaceMemberships.role,
            joinedAt: workspaceMemberships.createdAt,
          });

        if (!membership) {
          throw new Error("Member insert returned no row");
        }

        return {
          userId: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          ...membership,
        };
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new HttpError(
            409,
            "MEMBER_ALREADY_EXISTS",
            ERROR_MESSAGES.MEMBER_ALREADY_EXISTS,
          );
        }

        throw error;
      }
    });
  }
  ```

  실제 구현에서는 기존 파일의 import 순서와 Prettier 줄바꿈을 따른다. `HttpError` 오류는 transaction callback에서 그대로 전파되어 공통 error handler가 처리하게 한다.

- [x] **Step 5: service focused 테스트를 실행한다**

  Run:

  ```bash
  pnpm --dir backend exec vitest run tests/member.test.ts -t "addMember"
  ```

  Expected: 성공, 권한, 대상 사용자, 중복, unique 오류, 일반 DB 오류 테스트가 모두 통과한다.

## Task 3: controller와 POST route를 TDD로 연결한다

**Files:**

- Modify: `backend/tests/member.test.ts`
- Modify: `backend/src/controllers/member.controller.ts`
- Modify: `backend/src/routes/member.routes.ts`

**Interfaces:**

- Consumes: `addMemberBodySchema`, `memberParamsSchema`, `addMember`, `requireUser`
- Produces: `POST /workspaces/:workspaceId/members` HTTP contract

- [x] **Step 1: route 부재를 확인하는 HTTP 테스트를 추가한다**

  `describe("POST /workspaces/:workspaceId/members", ...)`를 추가한다. 성공 테스트는 transaction mock을 준비하고 다음을 검증한다.

  ```ts
  const response = await request(createApp())
    .post(`/workspaces/${workspaceId}/members`)
    .set("Authorization", `Bearer ${await createAccessToken("owner-1")}`)
    .send({ userId: targetUserId });

  expect(response.status).toBe(201);
  expect(response.body).toEqual({
    member: {
      userId: targetUserId,
      name: "Kim Member",
      email: "member@example.com",
      role: "member",
      joinedAt: "2026-09-10T00:00:00.000Z",
    },
  });
  ```

  route가 아직 연결되지 않은 상태에서 실행해 404가 되는 것을 확인한다.

- [x] **Step 2: HTTP 오류 계약 테스트를 추가한다**

  다음 케이스마다 status, `response.body.error.code`, DB 호출 여부를 검증한다.

  ```text
  Authorization 없음                        -> 401 UNAUTHORIZED, transaction 없음
  workspaceId/userId UUID 오류 또는 body 누락 -> 400 VALIDATION_ERROR, transaction 없음
  requesterRows: []                         -> 404 WORKSPACE_NOT_FOUND
  requesterRows: [{ role: "member" }]       -> 403 MEMBER_ADD_FORBIDDEN
  userRows: []                               -> 404 USER_NOT_FOUND
  existingRows: [{ id: "membership-1" }]    -> 409 MEMBER_ALREADY_EXISTS
  insertError: new Error("insert failed")    -> 500 INTERNAL_SERVER_ERROR
  ```

  인증 실패와 입력 실패는 service가 호출되기 전에 종료되는지 `db.transaction` 호출 횟수로 확인한다.

- [x] **Step 3: controller와 route를 구현한다**

  `backend/src/controllers/member.controller.ts`에 다음 handler를 추가한다.

  ```ts
  export async function addMemberHandler(req: Request, res: Response) {
    const user = requireUser(req);
    const { workspaceId } = parseOrThrow(memberParamsSchema, req.params);
    const { userId } = parseOrThrow(addMemberBodySchema, req.body);

    const member = await addMember({
      workspaceId,
      requesterId: user.sub,
      userId,
    });

    res.status(201).json({ member });
  }
  ```

  `backend/src/routes/member.routes.ts`에 기존 GET route와 같은 인증/asyncHandler 조합으로 다음을 등록한다.

  ```ts
  memberRouter.post("/", authenticate, asyncHandler(addMemberHandler));
  ```

- [x] **Step 4: HTTP focused 테스트를 GREEN으로 확인한다**

  Run:

  ```bash
  pnpm --dir backend exec vitest run tests/member.test.ts -t "POST /workspaces"
  ```

  Expected: 성공 응답과 401/400/403/404/409/500 오류 테스트가 모두 통과한다.

## Task 4: 통합 검증과 구현 결과를 기록한다

**Files:**

- Verify: `backend/src/constants/messages.ts`
- Verify: `backend/src/schemas/member.schema.ts`
- Verify: `backend/src/services/member.service.ts`
- Verify: `backend/src/controllers/member.controller.ts`
- Verify: `backend/src/routes/member.routes.ts`
- Verify: `backend/tests/member.test.ts`
- Modify: `docs/superpowers/plans/2026-09-10-member-addition-backend-implementation-plan.md`

**Interfaces:**

- Consumes: Task 1~3의 구현과 테스트
- Produces: 검증된 멤버 추가 API와 실제 결과가 기록된 계획 문서

- [x] **Step 1: 멤버 추가 focused 테스트를 실행한다**

  Run:

  ```bash
  pnpm --dir backend exec vitest run tests/member.test.ts --reporter=dot --silent
  ```

  Expected: 기존 멤버 목록 테스트와 새 멤버 추가 테스트가 모두 통과한다.

- [x] **Step 2: 전체 백엔드 테스트를 실행한다**

  Run:

  ```bash
  pnpm --dir backend test -- --reporter=dot --silent
  ```

  Expected: 전체 Vitest suite가 실패 없이 통과한다.

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
    src/constants/messages.ts \
    src/schemas/member.schema.ts \
    src/services/member.service.ts \
    src/controllers/member.controller.ts \
    src/routes/member.routes.ts \
    tests/member.test.ts \
    ../docs/superpowers/specs/2026-09-10-member-addition-backend-design.md \
    ../docs/superpowers/plans/2026-09-10-member-addition-backend-implementation-plan.md
  ```

  Expected: 모든 변경 파일이 Prettier 형식과 일치한다.

- [x] **Step 5: diff와 작업 범위를 확인한다**

  Run:

  ```bash
  git diff --check
  git status --short
  git diff -- backend/src backend/tests docs/superpowers
  ```

  Expected: 멤버 추가 범위 외의 unrelated 변경, DB schema/migration 변경, frontend 변경이 없다.

- [x] **Step 6: Implementation Results를 기록한다**

  이 문서 하단에 다음 내용을 실제 수치와 파일명으로 추가한다.

  ```text
  실제 변경 내용
  계획과 달라진 점
  실행한 검증 명령과 결과
  남은 후속 작업
  ```

  결과 기록 후 `git diff --check`와 plan 문서 Prettier 검사를 다시 실행한다.

## Task 5: 최종 코드 리뷰를 수행한다

**Files:**

- Review: `backend/src/constants/messages.ts`
- Review: `backend/src/schemas/member.schema.ts`
- Review: `backend/src/services/member.service.ts`
- Review: `backend/src/controllers/member.controller.ts`
- Review: `backend/src/routes/member.routes.ts`
- Review: `backend/tests/member.test.ts`

**Interfaces:**

- Consumes: Task 1~4의 구현, 테스트 결과, 현재 worktree diff
- Produces: 권한·오류·동시성·응답 계약에 대한 최종 리뷰 결과

- [x] **Step 1: 현재 변경사항을 기준 커밋과 비교한다**

  Run:

  ```bash
  git diff -- backend/src backend/tests
  git diff --check
  ```

  Expected: 멤버 추가 API 범위의 변경만 있고 password hash, 토큰, 인증 헤더 등 민감 정보가 응답·로그·테스트 fixture에 포함되지 않는다.

- [x] **Step 2: 권한과 오류 계약을 리뷰한다**

  다음 항목을 파일과 테스트에서 각각 확인한다.

  ```text
  인증/입력 검증이 service보다 먼저 실행됨
  비멤버는 404, 일반 Member는 403
  대상 사용자 없음은 404
  사전 중복과 23505 unique 충돌은 409
  insert role은 항상 member
  예상하지 못한 오류는 공통 500
  ```

- [x] **Step 3: 리뷰에서 발견한 문제를 수정하고 전체 검증을 반복한다**

  리뷰에서 수정이 발생하면 `backend/tests/member.test.ts`에 해당 회귀 테스트를 먼저 추가하고 Task 4의 focused test, 전체 test, lint, build, Prettier를 다시 실행한다. 수정이 없으면 리뷰 결과와 검증 명령을 계획 문서의 `Implementation Results`에 기록한다.

## 최종 리뷰 체크리스트

- [x] `POST /workspaces/:workspaceId/members`가 기존 `memberRouter`에 등록되어 있다.
- [x] 요청자 인증과 path/body 검증이 service 호출 전에 실행된다.
- [x] Owner 권한이 아니면 insert가 실행되지 않는다.
- [x] 비멤버·일반 Member·대상 사용자 없음·중복 멤버십의 오류 코드가 설계 문서와 일치한다.
- [x] 멤버십 insert의 role이 항상 `member`다.
- [x] unique constraint `23505`를 `MEMBER_ALREADY_EXISTS`로만 변환한다.
- [x] 응답에 password hash 등 사용자 내부 정보가 포함되지 않는다.
- [x] 기존 멤버 목록 API와 기존 백엔드 테스트가 보존된다.
- [x] 구현 완료 후 별도 코드 리뷰를 수행하고 리뷰 결과를 최종 보고에 포함한다.

## Implementation Results

### 실제 변경 내용

- `POST /workspaces/:workspaceId/members`를 추가하고 Owner 전용 멤버 추가 흐름을 구현했다.
- `userId` UUID 입력 검증, 인증·권한 확인, 대상 사용자 조회, 중복 멤버십 확인, transaction 기반 insert를 추가했다.
- `WORKSPACE_NOT_FOUND`, `MEMBER_ADD_FORBIDDEN`, `USER_NOT_FOUND`, `MEMBER_ALREADY_EXISTS` 오류 계약과 성공 응답을 구현했다.
- 서비스·컨트롤러·라우트 테스트와 입력 검증 테스트를 추가했다.
- DB schema/migration, 프론트엔드, 이메일 초대 기능은 변경하지 않았다.

### 계획과 달라진 점

- 계획의 기능 범위와 API 계약에는 변경이 없다.
- 별도 subagent를 사용할 수 없는 환경이어서 계획 실행은 현재 worktree의 인라인 실행으로 진행했다.
- 구현 후 `member.service.ts`의 Prettier 형식만 보정했으며 기능 동작과 계획 범위에는 영향이 없다.
- 사용자가 커밋을 요청하지 않았으므로 변경사항은 커밋하지 않았다.

### 실행한 검증 명령과 결과

- `pnpm --dir backend exec vitest run tests/member.test.ts --reporter=dot --silent` — 1개 파일, 43개 테스트 통과
- `pnpm --dir backend test -- --reporter=dot --silent` — 21개 파일, 226개 테스트 통과
- `pnpm --dir backend lint` — 통과
- `pnpm --dir backend build` — 통과
- `pnpm --dir backend exec prettier --check` — 변경된 코드·테스트·설계·계획 문서 통과
- `git diff --check` — 통과
- 기준 커밋 `a095f8f4988e53f143701abe64ea75049ba188be` 대비 수동 2축 리뷰 — Standards/Spec 모두 발견사항 없음

### 남은 후속 작업

- 필수 후속 작업 없음.
- 실제 DB 연결을 사용하는 E2E 및 배포 환경 검증은 별도 환경 검증 범위다.
