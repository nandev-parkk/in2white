# 워크스페이스 멤버 내보내기 백엔드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner의 멤버 내보내기와 Member의 자기 탈퇴를 DELETE /workspaces/:workspaceId/members/:userId API로 구현한다.

**Architecture:** 기존 memberRouter → member.controller → member.service 계층을 확장한다. 서비스는 하나의 Drizzle 트랜잭션에서 요청자 멤버십과 역할을 확인하고, 허용된 경우 workspace_memberships 행만 삭제한다. Owner의 타인 내보내기와 Member의 자기 탈퇴를 같은 엔드포인트에서 처리하며, 프로젝트·화이트보드 문서와 creatorId는 변경하지 않는다.

**Tech Stack:** Node.js 20+, pnpm, TypeScript, Express, Drizzle ORM, Zod, Vitest, Supertest

**Spec:** docs/superpowers/specs/2026-09-10-member-removal-backend-design.md

## Global Constraints

- workspaceId와 userId는 모두 UUID로 검증하고 DB 접근 전에 잘못된 입력을 거부한다.
- 비멤버 요청자는 404 WORKSPACE_NOT_FOUND를 받고 대상 멤버 조회·삭제를 실행하지 않는다.
- Owner는 다른 멤버를 내보낼 수 있지만 자기 자신은 내보낼 수 없다.
- Member는 자기 자신만 탈퇴할 수 있고 다른 멤버를 내보낼 수 없다.
- 정상적인 내보내기·자기 탈퇴는 204 No Content를 반환한다.
- 멤버십만 삭제하고 사용자 계정, 프로젝트, 화이트보드 문서, creatorId는 변경하지 않는다.
- DB 스키마·마이그레이션과 새 의존성은 추가하지 않는다.
- 기존 authenticate, requireUser, HttpError, errorHandlerMiddleware 계약을 재사용한다.
- Node.js >=20과 저장소의 pnpm 명령을 사용한다.
- 사용자가 명시적으로 요청하기 전에는 commit, push, merge, PR을 실행하지 않는다.

## 파일 구조와 책임

- Modify: backend/src/constants/messages.ts — 내보내기·자기 탈퇴 오류 메시지
- Modify: backend/src/schemas/member.schema.ts — 두 UUID path parameter 스키마
- Modify: backend/src/services/member.service.ts — 트랜잭션 기반 권한 확인과 멤버십 삭제
- Modify: backend/src/controllers/member.controller.ts — path 검증, 서비스 호출, 204 응답
- Modify: backend/src/routes/member.routes.ts — DELETE 라우트 등록
- Modify: backend/tests/member.test.ts — 스키마·서비스·HTTP 회귀 테스트와 transaction mock
- Modify after implementation: docs/superpowers/plans/2026-09-10-member-removal-backend-implementation-plan.md — Implementation Results 기록

---

### Task 1: Path 스키마와 오류 계약을 테스트로 고정

**Files:**

- Modify: backend/tests/member.test.ts
- Modify: backend/src/constants/messages.ts
- Modify: backend/src/schemas/member.schema.ts

**Interfaces:**

- Produces: memberRemoveParamsSchema with { workspaceId: string; userId: string } output
- Produces: ERROR_MESSAGES.MEMBER_REMOVE_FORBIDDEN, ERROR_MESSAGES.MEMBER_SELF_REMOVE_FORBIDDEN, ERROR_MESSAGES.MEMBER_NOT_FOUND

- [x] Step 1: 삭제 path 스키마의 실패 테스트를 먼저 추가한다

backend/tests/member.test.ts의 schema import에 memberRemoveParamsSchema를 추가하고, 기존 memberParamsSchema 테스트 다음에 다음 케이스를 추가한다.

```ts
describe("memberRemoveParamsSchema", () => {
  it("workspaceId와 userId UUID를 허용한다", () => {
    expect(
      memberRemoveParamsSchema.parse({ workspaceId, userId: targetUserId }),
    ).toEqual({
      workspaceId,
      userId: targetUserId,
    });
  });

  it.each([
    { workspaceId: "not-a-uuid", userId: targetUserId },
    { workspaceId, userId: "not-a-uuid" },
  ])("UUID가 아닌 path parameter를 거부한다", (params) => {
    expect(() => memberRemoveParamsSchema.parse(params)).toThrow();
  });
});
```

- [x] Step 2: 스키마 테스트를 실행해 RED 상태를 확인한다

실행:

```bash
cd backend
pnpm vitest run tests/member.test.ts -t "memberRemoveParamsSchema"
```

예상 결과: memberRemoveParamsSchema가 아직 export되지 않아 테스트가 실패한다.

- [x] Step 3: 오류 메시지 상수와 path 스키마를 최소 구현한다

backend/src/constants/messages.ts에 다음 세 항목을 추가한다.

```ts
MEMBER_REMOVE_FORBIDDEN: "멤버를 내보낼 권한이 없습니다",
MEMBER_SELF_REMOVE_FORBIDDEN: "자기 자신은 내보낼 수 없습니다",
MEMBER_NOT_FOUND: "워크스페이스 멤버를 찾을 수 없습니다",
```

backend/src/schemas/member.schema.ts에는 기존 memberParamsSchema와 같은 UUID 오류 메시지를 사용해 다음 스키마를 추가한다.

```ts
export const memberRemoveParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  userId: z.uuid({ error: ERROR_MESSAGES.USER_ID_INVALID }),
});
```

- [x] Step 4: 스키마와 메시지 테스트를 실행해 GREEN 상태를 확인한다

실행:

```bash
cd backend
pnpm vitest run tests/member.test.ts -t "memberRemoveParamsSchema"
```

예상 결과: 새 schema 테스트가 통과한다.

---

### Task 2: 트랜잭션 기반 removeMember 서비스 구현

**Files:**

- Modify: backend/tests/member.test.ts
- Modify: backend/src/services/member.service.ts

**Interfaces:**

- Consumes: memberRemoveParamsSchema와 ERROR_MESSAGES의 오류 계약
- Produces: RemoveMemberInput { workspaceId: string; requesterId: string; userId: string }
- Produces: removeMember(input: RemoveMemberInput): Promise<void>

- [x] Step 1: 삭제 transaction mock과 서비스 실패 테스트를 추가한다

backend/tests/member.test.ts의 mockAddMemberTransaction 뒤에 다음 형태의 mock helper를 추가한다. db.transaction 콜백에 select와 delete 체인을 제공하고, 대상 삭제 결과를 deletedRows로 제어한다.

```ts
function mockRemoveMemberTransaction({
  requesterRows = [{ role: "owner" }],
  deletedRows = [{ id: "membership-2" }],
  requesterError,
  deleteError,
}: {
  requesterRows?: unknown[];
  deletedRows?: unknown[];
  requesterError?: Error;
  deleteError?: Error;
} = {}) {
  const requesterQuery = {
    from: vi.fn().mockReturnThis(),
    where: requesterError
      ? vi.fn().mockRejectedValue(requesterError)
      : vi.fn().mockResolvedValue(requesterRows),
  };
  const membershipDelete = {
    where: vi.fn().mockReturnThis(),
    returning: deleteError
      ? vi.fn().mockRejectedValue(deleteError)
      : vi.fn().mockResolvedValue(deletedRows),
  };
  const transaction = {
    select: vi.fn().mockReturnValue(requesterQuery),
    delete: vi.fn().mockReturnValue(membershipDelete),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) =>
    callback(transaction as never),
  );

  return { requesterQuery, membershipDelete, transaction };
}
```

서비스 import에 removeMember를 추가하고 describe("removeMember", ...) 안에 다음 케이스를 먼저 추가한다.

```ts
it("Owner가 다른 멤버를 내보낸다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction();

  await expect(
    removeMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
  ).resolves.toBeUndefined();

  expect(membershipDelete.where).toHaveBeenCalledWith(
    and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      eq(workspaceMemberships.userId, targetUserId),
    ),
  );
});

it("Member가 자기 자신을 탈퇴한다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction({
    requesterRows: [{ role: "member" }],
  });

  await expect(
    removeMember({ workspaceId, requesterId: "member-1", userId: "member-1" }),
  ).resolves.toBeUndefined();

  expect(membershipDelete.where).toHaveBeenCalledOnce();
});

it("비멤버 요청자는 워크스페이스 없음으로 거부하고 삭제하지 않는다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction({
    requesterRows: [],
  });

  await expect(
    removeMember({
      workspaceId,
      requesterId: "outsider",
      userId: targetUserId,
    }),
  ).rejects.toMatchObject({
    status: 404,
    code: "WORKSPACE_NOT_FOUND",
  });

  expect(membershipDelete.where).not.toHaveBeenCalled();
});

it("Member가 다른 멤버를 내보낼 수 없다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction({
    requesterRows: [{ role: "member" }],
  });

  await expect(
    removeMember({
      workspaceId,
      requesterId: "member-1",
      userId: targetUserId,
    }),
  ).rejects.toMatchObject({
    status: 403,
    code: "MEMBER_REMOVE_FORBIDDEN",
  });

  expect(membershipDelete.where).not.toHaveBeenCalled();
});

it("Owner가 자기 자신을 내보낼 수 없다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction();

  await expect(
    removeMember({ workspaceId, requesterId: "owner-1", userId: "owner-1" }),
  ).rejects.toMatchObject({
    status: 403,
    code: "MEMBER_SELF_REMOVE_FORBIDDEN",
  });

  expect(membershipDelete.where).not.toHaveBeenCalled();
});

it("대상 멤버십이 없으면 MEMBER_NOT_FOUND를 반환한다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction({ deletedRows: [] });

  await expect(
    removeMember({ workspaceId, requesterId: "owner-1", userId: targetUserId }),
  ).rejects.toMatchObject({
    status: 404,
    code: "MEMBER_NOT_FOUND",
  });
});
```

서비스의 요청자 DB 오류와 삭제 DB 오류도 기존 서비스 테스트 스타일로 각각 추가해 공통 오류 전파를 고정한다.

- [x] Step 2: 서비스 테스트를 실행해 RED 상태를 확인한다

실행:

```bash
cd backend
pnpm vitest run tests/member.test.ts -t "removeMember"
```

예상 결과: removeMember가 아직 export되지 않아 실패한다.

- [x] Step 3: removeMember를 트랜잭션으로 구현한다

backend/src/services/member.service.ts에 다음 규칙을 구현한다.

```ts
export interface RemoveMemberInput {
  workspaceId: string;
  requesterId: string;
  userId: string;
}

export async function removeMember({
  workspaceId,
  requesterId,
  userId,
}: RemoveMemberInput): Promise<void> {
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

    const isSelfRemoval = requesterId === userId;

    if (isSelfRemoval && requesterMembership.role === "owner") {
      throw new HttpError(
        403,
        "MEMBER_SELF_REMOVE_FORBIDDEN",
        ERROR_MESSAGES.MEMBER_SELF_REMOVE_FORBIDDEN,
      );
    }

    if (!isSelfRemoval && requesterMembership.role !== "owner") {
      throw new HttpError(
        403,
        "MEMBER_REMOVE_FORBIDDEN",
        ERROR_MESSAGES.MEMBER_REMOVE_FORBIDDEN,
      );
    }

    const [deletedMembership] = await tx
      .delete(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, userId),
        ),
      )
      .returning({ id: workspaceMemberships.id });

    if (!deletedMembership) {
      throw new HttpError(
        404,
        "MEMBER_NOT_FOUND",
        ERROR_MESSAGES.MEMBER_NOT_FOUND,
      );
    }
  });
}
```

returning 결과가 빈 배열이면 대상 멤버십이 없거나 동시 요청에서 이미 삭제된 것으로 보고 MEMBER_NOT_FOUND를 반환한다. 사용자·프로젝트·문서 테이블에는 접근하지 않는다.

- [x] Step 4: 서비스 테스트를 실행해 GREEN 상태를 확인한다

실행:

```bash
cd backend
pnpm vitest run tests/member.test.ts -t "removeMember"
```

예상 결과: Owner 타인 삭제, Member 자기 탈퇴, 권한 오류, 대상 없음, DB 오류 테스트가 통과한다.

---

### Task 3: Controller와 DELETE 라우트 연결

**Files:**

- Modify: backend/tests/member.test.ts
- Modify: backend/src/controllers/member.controller.ts
- Modify: backend/src/routes/member.routes.ts

**Interfaces:**

- Consumes: memberRemoveParamsSchema, removeMember, requireUser
- Produces: removeMemberHandler(req: Request, res: Response)
- Produces: DELETE /workspaces/:workspaceId/members/:userId

- [x] Step 1: HTTP 계약 테스트를 먼저 추가한다

describe("DELETE /workspaces/:workspaceId/members/:userId", ...)를 backend/tests/member.test.ts 마지막에 추가한다. 다음 케이스를 포함한다.

Task 1에서 승인한 `memberRemoveParamsSchema`는 `workspaceId`와 `userId` 모두 유효한 UUID를 요구한다. 따라서 brief의 비UUID 예시 `member-1`과 `owner-1`은 아래 `memberUserId`와 `ownerUserId` fixture로 정정하며, 승인된 UUID 계약이 비UUID 예시보다 우선한다.

```ts
const memberUserId = "550e8400-e29b-41d4-a716-446655440002";
const ownerUserId = "550e8400-e29b-41d4-a716-446655440003";

it("Owner가 다른 멤버를 내보내고 204를 반환한다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction();

  const response = await request(createApp())
    .delete("/workspaces/" + workspaceId + "/members/" + targetUserId)
    .set("Authorization", "Bearer " + (await createAccessToken(ownerUserId)));

  expect(response.status).toBe(204);
  expect(response.body).toEqual({});
  expect(membershipDelete.where).toHaveBeenCalledOnce();
});

it("Member가 자기 자신을 탈퇴하고 204를 반환한다", async () => {
  mockRemoveMemberTransaction({ requesterRows: [{ role: "member" }] });

  const response = await request(createApp())
    .delete("/workspaces/" + workspaceId + "/members/" + memberUserId)
    .set("Authorization", "Bearer " + (await createAccessToken(memberUserId)));

  expect(response.status).toBe(204);
});

it("인증되지 않은 요청은 401을 반환한다", async () => {
  const response = await request(createApp()).delete(
    "/workspaces/" + workspaceId + "/members/" + targetUserId,
  );

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe("UNAUTHORIZED");
  expect(db.transaction).not.toHaveBeenCalled();
});

it("Member의 타인 내보내기는 403을 반환한다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction({
    requesterRows: [{ role: "member" }],
  });

  const response = await request(createApp())
    .delete("/workspaces/" + workspaceId + "/members/" + targetUserId)
    .set("Authorization", "Bearer " + (await createAccessToken(memberUserId)));

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe("MEMBER_REMOVE_FORBIDDEN");
  expect(membershipDelete.where).not.toHaveBeenCalled();
});

it("Owner 자기 탈퇴는 403을 반환한다", async () => {
  const { membershipDelete } = mockRemoveMemberTransaction();

  const response = await request(createApp())
    .delete("/workspaces/" + workspaceId + "/members/" + ownerUserId)
    .set("Authorization", "Bearer " + (await createAccessToken(ownerUserId)));

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe("MEMBER_SELF_REMOVE_FORBIDDEN");
  expect(membershipDelete.where).not.toHaveBeenCalled();
});
```

다음 HTTP 케이스도 함께 추가한다.

```ts
it.each([
  "not-a-uuid/members/" + targetUserId,
  workspaceId + "/members/not-a-uuid",
])(
  "잘못된 path parameter는 400이고 transaction을 호출하지 않는다",
  async (path) => {
    const response = await request(createApp())
      .delete("/workspaces/" + path)
      .set("Authorization", "Bearer " + (await createAccessToken(ownerUserId)));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  },
);

it("대상 멤버십이 없으면 404 MEMBER_NOT_FOUND를 반환한다", async () => {
  mockRemoveMemberTransaction({ deletedRows: [] });

  const response = await request(createApp())
    .delete("/workspaces/" + workspaceId + "/members/" + targetUserId)
    .set("Authorization", "Bearer " + (await createAccessToken(ownerUserId)));

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("MEMBER_NOT_FOUND");
});

it("DB 오류는 500 INTERNAL_SERVER_ERROR로 변환한다", async () => {
  mockRemoveMemberTransaction({
    deleteError: new Error("membership delete failed"),
  });

  const response = await request(createApp())
    .delete("/workspaces/" + workspaceId + "/members/" + targetUserId)
    .set("Authorization", "Bearer " + (await createAccessToken(ownerUserId)));

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
});
```

- [x] Step 2: HTTP 테스트를 실행해 RED 상태를 확인한다

실행:

```bash
cd backend
pnpm vitest run tests/member.test.ts -t "DELETE /workspaces/:workspaceId/members/:userId"
```

예상 결과: DELETE 라우트와 handler가 아직 등록되지 않아 404 또는 import 실패가 발생한다.

- [x] Step 3: controller handler를 구현한다

backend/src/controllers/member.controller.ts의 import에 memberRemoveParamsSchema와 removeMember를 추가하고 다음 handler를 추가한다.

```ts
export async function removeMemberHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, userId } = parseOrThrow(
    memberRemoveParamsSchema,
    req.params,
  );

  await removeMember({
    workspaceId,
    requesterId: user.sub,
    userId,
  });

  res.status(204).send();
}
```

- [x] Step 4: member router에 DELETE 경로를 등록한다

backend/src/routes/member.routes.ts에서 handler를 import하고 기존 GET·POST 라우트와 같은 인증·비동기 래퍼를 사용한다.

```ts
memberRouter.delete(
  "/:userId",
  authenticate,
  asyncHandler(removeMemberHandler),
);
```

- [x] Step 5: HTTP 테스트를 실행해 GREEN 상태를 확인한다

실행:

```bash
cd backend
pnpm vitest run tests/member.test.ts -t "DELETE /workspaces/:workspaceId/members/:userId"
```

예상 결과: 성공·자기 탈퇴·인증·입력·권한·대상 없음·DB 오류 HTTP 테스트가 모두 통과한다.

---

### Task 4: 전체 회귀 검증과 결과 문서화

**Files:**

- Modify after implementation: docs/superpowers/plans/2026-09-10-member-removal-backend-implementation-plan.md

**Interfaces:**

- Consumes: Task 1–3의 API, 오류 계약, 테스트
- Produces: 검증 결과가 기록된 구현 계획과 변경 diff

- [x] Step 1: 멤버 기능 전체 테스트를 실행한다

실행:

```bash
cd backend
pnpm vitest run tests/member.test.ts
```

예상 결과: 기존 멤버 목록·추가 회귀 테스트와 새 내보내기·자기 탈퇴 테스트가 모두 통과한다.

- [x] Step 2: 전체 백엔드 테스트를 실행한다

실행:

```bash
cd backend
pnpm test
```

예상 결과: 전체 Vitest 테스트가 통과하고 기존 테스트 실패가 없어야 한다.

- [x] Step 3: lint와 production build를 실행한다

실행:

```bash
cd backend
pnpm lint
pnpm build
```

예상 결과: ESLint 오류와 TypeScript 빌드 오류가 없다.

- [x] Step 4: diff와 변경 범위를 확인한다

실행:

```bash
git diff --check
git status --short
git diff --stat
```

확인 내용:

- 변경 파일이 설계 문서의 범위에 포함되는가
- DB 스키마·마이그레이션·프론트엔드에 의도하지 않은 변경이 없는가
- 프로젝트·문서·사용자 계정 데이터를 삭제하거나 creatorId를 변경하지 않는가
- 오류 메시지와 상태 코드가 설계 문서와 일치하는가

- [x] Step 5: 최종 코드 리뷰를 요청한다

구현과 검증이 끝나면 superpowers:requesting-code-review 또는 저장소의 코드 리뷰 절차를 사용해 다음 축을 확인한다.

- Spec: Owner 타인 내보내기, Member 자기 탈퇴, Owner 자기 탈퇴 차단, 204 응답, 데이터 보존
- Standards: 기존 Express·Drizzle·Zod·Vitest 패턴, 오류 처리, 트랜잭션 경계
- Security: workspace 조건 누락, 비멤버 정보 노출, Member의 타인 삭제 우회

독립 서브에이전트 리뷰를 요청했으나 워크스페이스 크레딧 소진으로 실행되지 않았다. 대신 승인된 설계의 Spec·Standards·Security 체크리스트와 전체 diff를 직접 대조했으며, 추가 Critical·Important 이슈는 발견되지 않았다. Task 1·2의 독립 리뷰 결과와 수정 사항은 그대로 보존한다.

- [x] Step 6: 구현 계획의 Implementation Results를 갱신한다

구현 완료 후 계획 문서 끝에 `## Implementation Results` 제목을 추가하고, 실제 변경 내용, 계획과 달라진 점, 실행한 검증 명령과 결과, 남은 후속 작업을 각각 기록한다. 계획과 차이가 없거나 후속 작업이 없으면 해당 항목에 `없음`이라고 명시한다.

커밋은 사용자 요청이 있을 때 별도로 수행한다.

## Implementation Results

### 실제 변경 내용

- `DELETE /workspaces/:workspaceId/members/:userId` 라우트와 controller handler를 추가했다.
- 하나의 트랜잭션에서 요청자 멤버십·역할을 확인한 뒤 `workspace_memberships`의 대상 행만 삭제하는 `removeMember` 서비스를 추가했다.
- Owner의 타인 내보내기, Member의 자기 탈퇴, Owner 자기 탈퇴 차단, Member의 타인 내보내기 차단, 비멤버·대상 없음·DB 오류 계약을 구현했다.
- 두 path parameter의 UUID 스키마와 세 오류 메시지를 추가하고, 스키마·서비스·HTTP 회귀 테스트를 추가했다.
- 사용자 계정, 프로젝트, 화이트보드 문서, `creatorId`, DB 스키마·마이그레이션, 프론트엔드는 변경하지 않았다.

### 계획과 달라진 점

- Task 2 리뷰에서 UUID 문자열 대소문자 차이로 Owner 자기 탈퇴 제한을 우회할 가능성이 발견되어, 요청자와 대상 사용자 ID를 소문자로 정규화한 뒤 비교·조회하도록 보강했다.
- Task 3의 초기 HTTP 예시에 있던 비UUID `member-1`·`owner-1` self-removal path 값을 유효한 UUID fixture로 교정했다. 승인된 path UUID 계약은 변경하지 않았다.
- 최종 독립 서브에이전트 리뷰는 워크스페이스 크레딧 소진으로 실행되지 않아 직접 Spec·Standards·Security 리뷰로 대체했다. Task 1·2의 독립 리뷰는 완료되었다.
- 사용자의 명시적 요청이 없어 commit, push, merge, PR은 실행하지 않았다.

### 실행한 검증 명령과 결과

- `cd backend && pnpm vitest run tests/member.test.ts` — 1개 파일, 64개 테스트 통과
- `cd backend && pnpm test` — 최종 기본 병렬 실행 10회 연속으로 매회 21개 파일, 247개 테스트 통과
- `cd backend && pnpm vitest run --maxWorkers=1` — 21개 파일, 247개 테스트 통과
- `cd backend && pnpm vitest run tests/member.test.ts -t "잘못된 path 또는 query는 400이며 DB를 조회하지 않는다"` — 기존 간헐 실패 대상 4개 케이스 단독 실행 통과
- `cd backend && pnpm lint` — 종료 코드 0
- `cd backend && pnpm build` — 종료 코드 0
- `git diff --check` — 종료 코드 0, 출력 없음
- `cd backend && pnpm exec prettier --check src/constants/messages.ts src/controllers/member.controller.ts src/routes/member.routes.ts src/schemas/member.schema.ts src/services/member.service.ts tests/member.test.ts ../docs/superpowers/specs/2026-09-10-member-removal-backend-design.md ../docs/superpowers/plans/2026-09-10-member-removal-backend-implementation-plan.md` — 최초 검사에서 문서 2개의 포맷 불일치를 확인해 `--write`로 정리한 뒤 최종 검사 통과
- 변경 범위 검토 — 백엔드 구현 6개 파일과 설계·계획 문서 2개만 변경되었으며 DB 스키마·마이그레이션·프론트엔드 변경 없음

### 남은 후속 작업

- 기능 완료를 위해 필요한 후속 작업은 없다.
- 기존 병렬 전체 테스트에서 Supertest 응답이 간헐적으로 유실되는 하네스 현상이 관찰되었다. 이번 작업 이전 Task 1에서도 같은 기존 GET 테스트의 `socket hang up`이 기록되었고, 최종 검증 중에는 기존 GET 멤버·POST 워크스페이스 테스트에서 각각 1회 재현되었다. 실패 위치가 이동하고 단독·단일 워커 실행 및 후속 기본 병렬 10회가 모두 통과해 이번 DELETE 기능 회귀와는 분리했으며, 테스트 하네스 안정화는 별도 후속 작업으로 추적할 수 있다.
- 선택 사항으로 워크스페이스 크레딧 복구 후 최종 독립 코드 리뷰를 다시 실행할 수 있다.
- 커밋·push·PR은 사용자 요청 시 별도로 진행한다.
