# 프로젝트 생성 백엔드 구현 계획

> **에이전트 작업자용:** 이 계획을 실행할 때는 `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`를 사용한다. 단계는 체크박스(`- [ ]`)로 추적하며, 각 구현 단계는 테스트 우선으로 진행한다.

**Goal:** 인증된 워크스페이스 Owner 또는 Member가 이름과 선택적 설명으로 프로젝트를 생성할 수 있는 `POST /workspaces/:workspaceId/projects` API를 추가한다.

**Architecture:** 기존 `routes → controllers → services → db/schema` 계층을 유지한다. 중첩된 프로젝트 라우터는 `workspaceId`를 전달하고, 프로젝트 서비스는 트랜잭션 안에서 사용자의 워크스페이스 멤버십을 확인한 뒤 `projects` 행을 생성한다. 프로젝트 테이블과 마이그레이션은 이미 존재하므로 DB 스키마 변경 없이 애플리케이션 계층만 추가한다.

**Tech Stack:** Node.js 20+, TypeScript, Express, Drizzle ORM/PostgreSQL, Zod, Vitest, Supertest, pnpm.

**Spec:** `docs/superpowers/specs/2026-09-08-project-creation-backend-design.md`

## Global Constraints

- 모든 문서와 사용자-facing 오류 메시지는 한국어로 작성한다.
- 엔드포인트는 `POST /workspaces/:workspaceId/projects`로 고정한다.
- Owner와 Member 모두 프로젝트를 생성할 수 있다.
- 비멤버는 `404 WORKSPACE_NOT_FOUND`로 응답한다.
- 프로젝트 이름은 trim 후 1~50자여야 한다.
- 프로젝트 설명은 선택값이며 trim 후 최대 200자이고, 누락·`null`·빈 문자열은 `null`로 저장한다.
- 프로젝트명 중복은 검사하거나 DB unique 제약으로 추가하지 않는다.
- `workspaceId`는 UUID 형식이어야 하며 형식이 잘못되면 `400 VALIDATION_ERROR`를 반환한다.
- 성공 응답은 `201 { project }` 형식이며, DB가 반환한 `createdAt`·`updatedAt`을 포함한다.
- 기존 `backend/src/db/schema/projects.ts`와 마이그레이션 파일은 수정하지 않는다.
- 실제 DB migration 실행, Git commit, push, merge는 사용자 요청 전까지 수행하지 않는다.
- 각 구현 단계에서 필요한 테스트를 먼저 작성하고 `pnpm --dir backend test`를 기준으로 검증한다.

---

## 파일 구조 및 책임

이번 작업에서 추가·수정하는 파일은 다음과 같다.

- Create: `backend/src/schemas/project.schema.ts` — 경로 파라미터와 생성 본문 검증·정규화
- Create: `backend/src/services/project.service.ts` — 멤버십 확인과 프로젝트 생성 유스케이스
- Create: `backend/src/controllers/project.controller.ts` — 인증 사용자 추출, 입력 파싱, HTTP 응답
- Create: `backend/src/routes/project.routes.ts` — 프로젝트 생성 라우트와 인증 미들웨어 연결
- Modify: `backend/src/routes/index.ts` — `/workspaces/:workspaceId/projects` 라우터 마운트
- Modify: `backend/src/constants/messages.ts` — 프로젝트 입력 검증 메시지
- Create: `backend/tests/project.test.ts` — Supertest 기반 API 계약 및 DB 호출 검증

`projects` 테이블의 `workspaceId`, `name`, `description`, `creatorId`, `createdAt`, `updatedAt` 컬럼과 Workspace 외래키는 이미 [`backend/src/db/schema/projects.ts`](../../../backend/src/db/schema/projects.ts)에 정의되어 있다. 따라서 이번 계획에는 스키마 파일·migration SQL·Drizzle 설정 변경을 포함하지 않는다.

## API 및 내부 인터페이스

### HTTP 계약

요청:

```http
POST /workspaces/:workspaceId/projects
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "name": "Brand Campaign",
  "description": "브랜드 캠페인 아이디어를 정리하는 프로젝트"
}
```

성공 응답:

```json
{
  "project": {
    "id": "project-uuid",
    "workspaceId": "workspace-uuid",
    "name": "Brand Campaign",
    "description": "브랜드 캠페인 아이디어를 정리하는 프로젝트",
    "creatorId": "user-uuid",
    "createdAt": "2026-09-08T00:00:00.000Z",
    "updatedAt": "2026-09-08T00:00:00.000Z"
  }
}
```

### 서비스 인터페이스

```ts
export interface CreateProjectInput {
  workspaceId: string;
  name: string;
  description: string | null;
  creatorId: string;
}

export async function createProject(
  input: CreateProjectInput,
): Promise<typeof projects.$inferSelect>;
```

서비스는 `workspace_memberships`에서 `workspaceId`와 `creatorId`가 일치하는 행을 조회한다. 행이 없으면 `HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND)`를 발생시키고, 행이 있으면 `projects`에 다음 값을 삽입한다.

```ts
{
  workspaceId,
  name,
  description,
  creatorId,
}
```

---

### Task 1: 프로젝트 생성 API 실패 테스트 작성

**Files:**
- Create: `backend/tests/project.test.ts`

**Interfaces:**
- Consumes: 기존 `createApp()`, `signAccessToken()`, `db.transaction` mock 패턴, `projects`·`workspaceMemberships` 스키마 객체
- Produces: Task 2와 Task 3이 만족해야 하는 HTTP·DB 호출 계약

- [ ] **Step 1: 테스트 파일의 mock과 공통 fixture를 작성한다.**

  `backend/tests/project.test.ts`를 만들고 아래 내용을 추가한다. 테스트용 경로 ID는 실제 UUID 검증을 통과하도록 고정하고, JWT의 `sub`는 기존 테스트처럼 `user-1`을 사용한다.

  ```ts
  import request from "supertest";
  import { beforeEach, describe, expect, it, vi } from "vitest";
  import { and, eq } from "drizzle-orm";
  import { createApp } from "@/app";
  import { db } from "@/db/client";
  import { projects, workspaceMemberships } from "@/db/schema";
  import { signAccessToken } from "@/lib/jwt";

  vi.mock("@/db/client", () => ({
    db: {
      transaction: vi.fn(),
    },
  }));

  const workspaceId = "00000000-0000-0000-0000-000000000001";

  const createdProject = {
    id: "00000000-0000-0000-0000-000000000011",
    workspaceId,
    name: "Brand Campaign",
    description: "브랜드 캠페인 아이디어를 정리하는 프로젝트",
    creatorId: "user-1",
    createdAt: new Date("2026-09-08T00:00:00.000Z"),
    updatedAt: new Date("2026-09-08T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.mocked(db.transaction).mockReset();
  });

  async function createAccessToken() {
    return signAccessToken({
      sub: "user-1",
      email: "user@example.com",
      sid: "session-1",
    });
  }

  function mockProjectCreateTransaction({
    membershipRows = [{ id: "membership-1" }],
    projectRows = [createdProject],
    membershipError,
    insertError,
  }: {
    membershipRows?: unknown[];
    projectRows?: unknown[];
    membershipError?: Error;
    insertError?: Error;
  } = {}) {
    const membershipQuery = {
      from: vi.fn().mockReturnThis(),
      where: membershipError
        ? vi.fn().mockRejectedValue(membershipError)
        : vi.fn().mockResolvedValue(membershipRows),
    };
    const projectInsert = {
      values: vi.fn().mockReturnThis(),
      returning: insertError
        ? vi.fn().mockRejectedValue(insertError)
        : vi.fn().mockResolvedValue(projectRows),
    };
    const transaction = {
      select: vi.fn().mockReturnValue(membershipQuery),
      insert: vi.fn().mockReturnValue(projectInsert),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );

    return { membershipQuery, projectInsert, transaction };
  }
  ```

- [ ] **Step 2: 성공과 정규화 계약을 검증하는 테스트를 추가한다.**

  fixture helper 다음에 아래 테스트를 추가한다. 이 테스트는 `name`과 `description`의 앞뒤 공백이 서비스 insert 전에 제거되고, 201 응답이 생성 행 전체를 반환하는지 검증한다.

  ```ts
  describe("POST /workspaces/:workspaceId/projects", () => {
    it("creates a project for a workspace member and returns 201", async () => {
      const { membershipQuery, projectInsert, transaction } = mockProjectCreateTransaction();

      const response = await request(createApp())
        .post(`/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send({
          name: "  Brand Campaign  ",
          description: "  브랜드 캠페인 아이디어를 정리하는 프로젝트  ",
        });

      expect(response.status).toBe(201);
      expect(response.body.project).toEqual({
        ...createdProject,
        createdAt: createdProject.createdAt.toISOString(),
        updatedAt: createdProject.updatedAt.toISOString(),
      });
      expect(db.transaction).toHaveBeenCalledOnce();
      expect(transaction.select).toHaveBeenCalledWith({ id: workspaceMemberships.id });
      expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
      expect(membershipQuery.where).toHaveBeenCalledWith(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, "user-1"),
        ),
      );
      expect(transaction.insert).toHaveBeenCalledWith(projects);
      expect(projectInsert.values).toHaveBeenCalledWith({
        workspaceId,
        name: "Brand Campaign",
        description: "브랜드 캠페인 아이디어를 정리하는 프로젝트",
        creatorId: "user-1",
      });
    });

    it.each(["owner", "member"] as const)(
      "allows a workspace %s to create a project",
      async (role) => {
        mockProjectCreateTransaction({
          membershipRows: [{ id: `membership-${role}`, role }],
        });

        const response = await request(createApp())
          .post(`/workspaces/${workspaceId}/projects`)
          .set("Authorization", `Bearer ${await createAccessToken()}`)
          .send({ name: "Brand Campaign" });

        expect(response.status).toBe(201);
      },
    );

    it.each([undefined, null, "   "])(
      "stores a missing, null, or blank description as null",
      async (description) => {
        const { projectInsert } = mockProjectCreateTransaction({
          projectRows: [{ ...createdProject, description: null }],
        });
        const body =
          description === undefined
            ? { name: "Brand Campaign" }
            : { name: "Brand Campaign", description };

        const response = await request(createApp())
          .post(`/workspaces/${workspaceId}/projects`)
          .set("Authorization", `Bearer ${await createAccessToken()}`)
          .send(body);

        expect(response.status).toBe(201);
        expect(projectInsert.values).toHaveBeenCalledWith({
          workspaceId,
          name: "Brand Campaign",
          description: null,
          creatorId: "user-1",
        });
      },
    );

  ```

  이 단계에서는 `describe` 블록을 닫지 않는다. Task 3에서 실패 테스트를 같은 블록 안에 이어서 추가하고 마지막에 `});`를 작성한다.

- [ ] **Step 3: 인증·검증·멤버십·DB 오류 테스트를 추가하고 describe 블록을 닫는다.**

  첫 번째 `describe` 안에서 성공 테스트 뒤에 아래 실패 테스트를 추가한다. 잘못된 입력은 트랜잭션을 호출하지 않아 컨트롤러 검증 경계를 고정하고, 비멤버는 insert를 호출하지 않아 서비스 권한 경계를 고정한다.

  ```ts
    it("returns 401 when the request is not authenticated", async () => {
      const response = await request(createApp())
        .post(`/workspaces/${workspaceId}/projects`)
        .send({ name: "Brand Campaign" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it.each([
      { label: "name is missing", pathWorkspaceId: workspaceId, body: {} },
      { label: "name is blank", pathWorkspaceId: workspaceId, body: { name: "   " } },
      { label: "name is longer than 50 characters", pathWorkspaceId: workspaceId, body: { name: "a".repeat(51) } },
      { label: "description is longer than 200 characters", pathWorkspaceId: workspaceId, body: { name: "Brand Campaign", description: "a".repeat(201) } },
      { label: "workspace id is not a UUID", pathWorkspaceId: "not-a-uuid", body: { name: "Brand Campaign" } },
    ])("returns 400 when $label", async ({ pathWorkspaceId, body }) => {
      const response = await request(createApp())
        .post(`/workspaces/${pathWorkspaceId}/projects`)
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it("returns 404 and does not insert when the user is not a workspace member", async () => {
      const { projectInsert } = mockProjectCreateTransaction({ membershipRows: [] });

      const response = await request(createApp())
        .post(`/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send({ name: "Brand Campaign" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
      expect(projectInsert.values).not.toHaveBeenCalled();
    });

    it("returns 500 when the membership query fails", async () => {
      mockProjectCreateTransaction({ membershipError: new Error("membership query failed") });

      const response = await request(createApp())
        .post(`/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send({ name: "Brand Campaign" });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("returns 500 when the project insert fails", async () => {
      mockProjectCreateTransaction({ insertError: new Error("project insert failed") });

      const response = await request(createApp())
        .post(`/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send({ name: "Brand Campaign" });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });
  ```

  `it.each`의 입력 객체가 Prettier에서 한 줄로 합쳐지더라도 의미를 바꾸지 않는다. 실제 파일의 describe 블록은 위 성공·실패 테스트를 모두 포함한 뒤 `});`로 닫는다.

- [ ] **Step 4: 테스트를 실행해 RED 상태를 확인한다.**

  Run:

  ```bash
  pnpm --dir backend test -- tests/project.test.ts
  ```

  Expected: 프로젝트 라우터가 아직 마운트되지 않았으므로 인증된 유효 요청도 404가 되고, 새 테스트가 실패한다. 기존 테스트 파일은 이 단계에서 실행하지 않아도 된다.

- [ ] **Step 5: 테스트 파일의 포맷과 assertion 범위를 확인한다.**

  Run:

  ```bash
  pnpm --dir backend exec prettier --check tests/project.test.ts
  git diff --check
  ```

  Expected: Prettier 검사와 공백 검사가 통과한다. 테스트는 응답 코드뿐 아니라 `workspaceId`, `creatorId`, 정규화된 필드, 멤버십 query, insert 미호출을 검증해야 한다.

### Task 2: 입력 스키마와 프로젝트 생성 서비스 구현

**Files:**
- Modify: `backend/src/constants/messages.ts`
- Create: `backend/src/schemas/project.schema.ts`
- Create: `backend/src/services/project.service.ts`

**Interfaces:**
- Consumes: Task 1의 `POST /workspaces/:workspaceId/projects` 테스트 계약
- Produces: `projectParamsSchema`, `createProjectSchema`, `CreateProjectInput`, `createProject()`

- [ ] **Step 1: 프로젝트 입력 오류 메시지를 추가한다.**

  `backend/src/constants/messages.ts`의 Workspace 관련 메시지 다음에 아래 항목을 추가한다.

  ```ts
  WORKSPACE_ID_INVALID: "유효하지 않은 워크스페이스 ID입니다",
  PROJECT_NAME_REQUIRED: "프로젝트 이름을 입력해주세요",
  PROJECT_NAME_TOO_LONG: "프로젝트 이름은 50자 이내로 입력해주세요",
  PROJECT_DESCRIPTION_INVALID: "프로젝트 설명은 문자열이어야 합니다",
  PROJECT_DESCRIPTION_TOO_LONG: "프로젝트 설명은 200자 이내로 입력해주세요",
  ```

  기존 `WORKSPACE_NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_SERVER_ERROR`와 기존 Workspace 메시지는 변경하지 않는다.

- [ ] **Step 2: 경로 파라미터와 본문 스키마를 작성한다.**

  `backend/src/schemas/project.schema.ts`를 만들고 아래 구현을 작성한다.

  ```ts
  import { z } from "zod";
  import { ERROR_MESSAGES } from "@/constants/messages";

  const projectNameSchema = z
    .string({ error: ERROR_MESSAGES.PROJECT_NAME_REQUIRED })
    .trim()
    .min(1, ERROR_MESSAGES.PROJECT_NAME_REQUIRED)
    .max(50, ERROR_MESSAGES.PROJECT_NAME_TOO_LONG);

  const projectDescriptionSchema = z
    .string({ error: ERROR_MESSAGES.PROJECT_DESCRIPTION_INVALID })
    .trim()
    .max(200, ERROR_MESSAGES.PROJECT_DESCRIPTION_TOO_LONG)
    .nullable()
    .optional()
    .transform((description) => description || null);

  export const projectParamsSchema = z.object({
    workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  });

  export const createProjectSchema = z.object({
    name: projectNameSchema,
    description: projectDescriptionSchema,
  });
  ```

  `projectDescriptionSchema`의 transform은 누락·`undefined`·`null`·trim 결과가 빈 문자열인 경우 모두 `null`을 반환한다. `name`은 trim 결과를 그대로 반환하므로 서비스에는 정규화된 값만 전달된다.

- [ ] **Step 3: 멤버십 확인과 프로젝트 insert를 트랜잭션으로 구현한다.**

  `backend/src/services/project.service.ts`를 만들고 아래 구현을 작성한다.

  ```ts
  import { and, eq } from "drizzle-orm";
  import { ERROR_MESSAGES } from "@/constants/messages";
  import { db } from "@/db/client";
  import { projects, workspaceMemberships } from "@/db/schema";
  import { HttpError } from "@/utils/http-error";

  export interface CreateProjectInput {
    workspaceId: string;
    name: string;
    description: string | null;
    creatorId: string;
  }

  export async function createProject({
    workspaceId,
    name,
    description,
    creatorId,
  }: CreateProjectInput): Promise<typeof projects.$inferSelect> {
    return db.transaction(async (tx) => {
      const [membership] = await tx
        .select({ id: workspaceMemberships.id })
        .from(workspaceMemberships)
        .where(
          and(
            eq(workspaceMemberships.workspaceId, workspaceId),
            eq(workspaceMemberships.userId, creatorId),
          ),
        );

      if (!membership) {
        throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
      }

      const [project] = await tx
        .insert(projects)
        .values({ workspaceId, name, description, creatorId })
        .returning();

      if (!project) {
        throw new Error("Project insert returned no row");
      }

      return project;
    });
  }
  ```

  멤버십의 `role` 값은 검사하지 않는다. `owner`와 `member` 모두 생성 권한을 갖는다는 제품 규칙을 만족하기 위해 멤버십 행의 존재만 확인한다. 멤버십이 없으면 insert를 호출하지 않고, DB 오류는 기존 `errorHandlerMiddleware`가 500으로 변환한다.

- [ ] **Step 4: 서비스와 스키마의 타입 검사를 실행한다.**

  Run:

  ```bash
  pnpm --dir backend exec tsc --noEmit
  ```

  Expected: 새 스키마와 서비스의 TypeScript 오류가 없다. HTTP 라우트가 아직 연결되지 않았으므로 Task 1 테스트는 아직 RED일 수 있다.

- [ ] **Step 5: 집중 테스트를 다시 실행해 라우팅 미구현 상태를 확인한다.**

  Run:

  ```bash
  pnpm --dir backend test -- tests/project.test.ts
  ```

  Expected: 스키마·서비스는 존재하지만 컨트롤러와 라우터가 아직 없으므로 유효 요청 테스트는 계속 404로 실패한다. 이 단계에서 테스트를 통과시키기 위해 테스트를 완화하거나 route를 임시로 추가하지 않는다.

### Task 3: 컨트롤러·라우터를 연결해 프로젝트 생성 API를 GREEN으로 만든다

**Files:**
- Create: `backend/src/controllers/project.controller.ts`
- Create: `backend/src/routes/project.routes.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Consumes: Task 2의 `projectParamsSchema`, `createProjectSchema`, `createProject()` 서비스
- Produces: 외부 HTTP API `POST /workspaces/:workspaceId/projects`

- [ ] **Step 1: 인증·검증·응답을 담당하는 컨트롤러를 작성한다.**

  `backend/src/controllers/project.controller.ts`를 만들고 아래 구현을 작성한다.

  ```ts
  import type { Request, Response } from "express";
  import { createProjectSchema, projectParamsSchema } from "@/schemas/project.schema";
  import { createProject } from "@/services/project.service";
  import { parseOrThrow } from "@/utils/parse-or-throw";
  import { requireUser } from "@/utils/require-user";

  export async function createProjectHandler(req: Request, res: Response) {
    const user = requireUser(req);
    const { workspaceId } = parseOrThrow(projectParamsSchema, req.params);
    const { name, description } = parseOrThrow(createProjectSchema, req.body);

    const project = await createProject({
      workspaceId,
      name,
      description,
      creatorId: user.sub,
    });

    res.status(201).json({ project });
  }
  ```

  `requireUser`를 입력 파싱보다 먼저 호출해 인증되지 않은 요청이 validation이나 DB 계층까지 도달하지 않게 한다. 날짜 직렬화는 기존 Express JSON 응답 동작에 맡긴다.

- [ ] **Step 2: merge params를 사용하는 프로젝트 라우터를 작성한다.**

  `backend/src/routes/project.routes.ts`를 만들고 아래 구현을 작성한다.

  ```ts
  import { Router } from "express";
  import { createProjectHandler } from "@/controllers/project.controller";
  import { authenticate } from "@/middlewares/auth.middleware";
  import { asyncHandler } from "@/utils/async-handler";

  export const projectRouter = Router({ mergeParams: true });

  projectRouter.post("/", authenticate, asyncHandler(createProjectHandler));
  ```

  `mergeParams: true`를 사용해 상위 mount path의 `workspaceId`가 `req.params.workspaceId`로 컨트롤러에 전달되도록 한다.

- [ ] **Step 3: 전역 라우터에 중첩 프로젝트 라우터를 마운트한다.**

  `backend/src/routes/index.ts`에 import를 추가하고, 일반 Workspace 라우터보다 먼저 중첩 라우터를 등록한다.

  ```ts
  import { projectRouter } from "@/routes/project.routes";
  ```

  ```ts
  router.use("/workspaces/:workspaceId/projects", projectRouter);
  router.use("/workspaces", workspaceRouter);
  ```

  최종 파일의 관련 부분은 다음 순서여야 한다.

  ```ts
  router.use("/health", healthRouter);
  router.use("/auth", authRouter);
  router.use("/workspaces/:workspaceId/projects", projectRouter);
  router.use("/workspaces", workspaceRouter);
  ```

  기존 Workspace 라우트의 경로와 응답은 변경하지 않는다.

- [ ] **Step 4: 집중 테스트를 실행해 GREEN을 확인한다.**

  Run:

  ```bash
  pnpm --dir backend test -- tests/project.test.ts
  ```

  Expected: `project.test.ts`의 모든 테스트가 PASS한다. 특히 Owner/Member 생성, 설명 `null` 정규화, UUID 검증, 비멤버 404, DB 오류 500 테스트가 통과해야 한다.

- [ ] **Step 5: 변경된 파일의 포맷과 타입을 확인한다.**

  Run:

  ```bash
  pnpm --dir backend exec prettier --check src/constants/messages.ts src/schemas/project.schema.ts src/services/project.service.ts src/controllers/project.controller.ts src/routes/project.routes.ts src/routes/index.ts tests/project.test.ts
  pnpm --dir backend exec tsc --noEmit
  ```

  Expected: Prettier와 TypeScript 검사가 모두 PASS한다. 실패 시 동작을 바꾸지 않고 해당 파일의 포맷 또는 타입만 수정한다.

### Task 4: 전체 회귀 검증 및 변경 범위 확인

**Files:**
- Verify: `backend/src/constants/messages.ts`
- Verify: `backend/src/schemas/project.schema.ts`
- Verify: `backend/src/services/project.service.ts`
- Verify: `backend/src/controllers/project.controller.ts`
- Verify: `backend/src/routes/project.routes.ts`
- Verify: `backend/src/routes/index.ts`
- Verify: `backend/tests/project.test.ts`

**Interfaces:**
- Consumes: Task 3의 완성된 프로젝트 생성 API
- Produces: 전체 백엔드 회귀 테스트와 빌드·lint·format 검증 결과

- [ ] **Step 1: 전체 백엔드 테스트를 실행한다.**

  Run:

  ```bash
  pnpm --dir backend test
  ```

  Expected: 기존 인증·Workspace·DB·미들웨어 테스트와 새 프로젝트 테스트가 모두 PASS한다.

- [ ] **Step 2: lint와 production build를 실행한다.**

  Run:

  ```bash
  pnpm --dir backend lint
  pnpm --dir backend build
  ```

  Expected: ESLint 오류가 없고 `backend/dist` 빌드가 성공한다. 실제 서버 실행이나 DB 연결은 수행하지 않는다.

- [ ] **Step 3: 전체 소스·테스트 포맷 검사를 실행한다.**

  Run:

  ```bash
  pnpm --dir backend exec prettier --check src tests
  ```

  Expected: 저장소의 기존 포맷 기준과 새 파일이 모두 일치한다.

- [ ] **Step 4: diff 공백과 의도하지 않은 변경을 확인한다.**

  Run:

  ```bash
  git diff --check
  git status --short
  git diff --stat
  ```

  Expected: 공백 오류가 없고, 변경 목록에는 프로젝트 생성 설계·계획 문서와 이번 기능의 백엔드 파일만 포함된다. 기존 사용자 변경 사항은 되돌리거나 정리하지 않는다.

- [ ] **Step 5: 최종 요구사항 대조를 완료한다.**

  다음 항목을 코드와 테스트에서 각각 확인한다.

  - `POST /workspaces/:workspaceId/projects`가 실제 라우터에 연결되어 있다.
  - 인증되지 않은 요청은 401이며 `db.transaction`이 호출되지 않는다.
  - Owner와 Member 멤버십 모두 생성할 수 있다.
  - 비멤버는 `404 WORKSPACE_NOT_FOUND`이고 `projects` insert가 실행되지 않는다.
  - 이름은 trim 후 1~50자이며, 설명은 trim 후 최대 200자다.
  - 설명 누락·`null`·공백은 `null`로 저장된다.
  - `workspaceId` UUID 오류는 400이다.
  - 생성 행의 `creatorId`가 Access Token의 `sub`와 같다.
  - 프로젝트명 중복 검사를 새로 추가하지 않았다.
  - DB schema와 migration을 변경하지 않았다.
  - 커밋이나 실제 migration을 실행하지 않았다.

## Self-Review

### Spec coverage

- API 경로·응답: Task 1, Task 3
- Owner/Member 생성 권한: Task 1, Task 2
- 비멤버 404 및 insert 차단: Task 1, Task 2
- 이름 50자·설명 200자 검증: Task 1, Task 2
- 설명 빈 값의 `null` 정규화: Task 1, Task 2
- UUID 경로 검증: Task 1, Task 2
- 트랜잭션 기반 멤버십 확인과 insert: Task 1, Task 2
- MVC 파일 경계 및 라우터 마운트: Task 2, Task 3
- DB schema/migration 미변경: Global Constraints, Task 4
- 전체 테스트·lint·build·format: Task 4

### Placeholder scan

모든 구현 단계에 대상 파일, 함수명, 입력·출력 계약, 코드 또는 실행 명령과 예상 결과를 포함했으며 실행 내용을 비워 둔 단계가 없다.

### Type consistency

- `projectParamsSchema`가 반환하는 `workspaceId: string`은 컨트롤러에서 서비스의 `CreateProjectInput.workspaceId`로 전달된다.
- `createProjectSchema`가 반환하는 `name: string`, `description: string | null`은 서비스 입력 타입과 일치한다.
- `createProject()`는 `typeof projects.$inferSelect`를 반환하고 컨트롤러는 이를 `{ project }`로 감싼다.
- `projectRouter`의 `mergeParams: true`가 mount path의 `workspaceId`를 컨트롤러의 `req.params`에 보존한다.
