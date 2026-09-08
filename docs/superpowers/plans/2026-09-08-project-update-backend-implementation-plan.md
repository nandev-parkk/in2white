# 프로젝트 수정 백엔드 구현 계획

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 인증된 워크스페이스 Owner 또는 해당 프로젝트 Creator가 프로젝트 name과 description을 부분 수정할 수 있는 PATCH API를 추가한다.

**Architecture:** 기존 routes → controllers → services → db/schema MVC 계층을 유지한다. 중첩 projectRouter의 mergeParams를 재사용하고, service는 하나의 transaction 안에서 membership·project·권한을 확인한 뒤 요청에 포함된 name과 description, updatedAt만 update한다. 기존 projects schema와 migration은 변경하지 않는다.

**Tech Stack:** Node.js 20+, TypeScript, Express, Drizzle ORM/PostgreSQL, Zod, Vitest, Supertest, pnpm.

**Spec:** docs/superpowers/specs/2026-09-08-project-update-backend-design.md

## Global Constraints

- API 경로는 PATCH /workspaces/:workspaceId/projects/:projectId로 고정한다.
- PATCH body의 name과 description은 각각 선택값이지만 최소 하나는 필수다.
- name은 포함된 경우 trim 후 1~50자여야 하며, 생략하면 기존 값을 유지한다.
- description은 포함된 경우 trim 후 최대 200자이며, null·공백은 null로 정규화하고 생략하면 기존 값을 유지한다.
- Owner는 같은 workspace의 모든 project를 수정할 수 있다.
- Member는 자신이 생성한 project만 수정할 수 있다.
- 비멤버는 404 WORKSPACE_NOT_FOUND를 반환하고 project를 조회하지 않는다.
- project가 없거나 다른 workspace에 속하면 404 PROJECT_NOT_FOUND를 반환한다.
- 권한 없는 Member는 403 PROJECT_UPDATE_FORBIDDEN을 반환한다.
- 성공 응답은 수정된 project 행 전체를 담은 200 { project } 형식이다.
- update 대상은 name, description, updatedAt으로 제한한다.
- 빈 PATCH body와 인증·입력 오류는 service의 DB query를 호출하지 않는다.
- 기존 projects schema, SQL migration, migration metadata, routes/index.ts는 변경하지 않는다.
- 기존 프로젝트 생성·목록 API 동작을 유지한다.
- 테스트를 먼저 작성하고 RED를 확인한 뒤 최소 구현한다.
- 사용자가 명시적으로 요청하기 전에는 Git commit, push, merge를 실행하지 않는다.
- 구현 완료 후 이 계획 문서에 실제 변경, 검증 결과, 계획과의 차이, 후속 작업을 기록한다.

---

## 파일 구조 및 책임

### 수정 파일

- Modify: backend/tests/project.test.ts
  - PATCH HTTP 계약과 transaction query 경계를 테스트한다.
- Modify: backend/src/constants/messages.ts
  - project ID·미존재·권한·빈 수정 body 메시지를 추가한다.
- Modify: backend/src/schemas/project.schema.ts
  - update path parameter schema와 partial body schema를 추가한다.
  - 생성용 description transform과 수정용 description transform을 분리한다.
- Modify: backend/src/services/project.service.ts
  - UpdateProjectInput과 updateProject service를 추가한다.
  - membership, creator 권한, workspace 소속, partial update를 처리한다.
- Modify: backend/src/controllers/project.controller.ts
  - updateProjectHandler를 추가한다.
- Modify: backend/src/routes/project.routes.ts
  - PATCH /:projectId를 인증 라우트로 등록한다.

### 변경하지 않는 파일

- backend/src/db/schema/projects.ts
- backend/src/db/migrations/**
- backend/src/routes/index.ts
- PRODUCT.md
- frontend/**

projects.updatedAt과 projects.description 컬럼은 이미 존재하므로 DB 구조 변경은 없다. routes/index.ts의 기존 mount가 workspaceId를 projectRouter에 전달하므로 route index 변경도 없다.

## 내부 인터페이스

### Schema exports

~~~ts
export const projectUpdateParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }),
});

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: updateProjectDescriptionSchema,
  })
  .refine(
    ({ name, description }) =>
      name !== undefined || description !== undefined,
    {
      message: ERROR_MESSAGES.PROJECT_UPDATE_FIELDS_REQUIRED,
    },
  );
~~~

updateProjectDescriptionSchema는 description이 undefined일 때 undefined를 유지해야 한다. null 또는 trim 결과 빈 문자열일 때만 null을 반환한다.

### Service exports

~~~ts
export interface UpdateProjectInput {
  workspaceId: string;
  projectId: string;
  userId: string;
  name?: string;
  description?: string | null;
}

export async function updateProject(
  input: UpdateProjectInput,
): Promise<typeof projects.$inferSelect>;
~~~

### Controller and route

~~~ts
export async function updateProjectHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId } = parseOrThrow(
    projectUpdateParamsSchema,
    req.params,
  );
  const { name, description } = parseOrThrow(updateProjectSchema, req.body);

  const project = await updateProject({
    workspaceId,
    projectId,
    userId: user.sub,
    name,
    description,
  });

  res.status(200).json({ project });
}
~~~

~~~ts
projectRouter.patch("/:projectId", authenticate, asyncHandler(updateProjectHandler));
~~~

## Task 1: 프로젝트 수정 API의 failing tests 작성

**Files:**

- Modify: backend/tests/project.test.ts

**Interfaces:**

- Consumes: 기존 createApp(), signAccessToken(), db.transaction mock, projects, workspaceMemberships
- Produces: 이후 schema·service·controller·route 구현이 만족해야 하는 PATCH 계약

- [x] Step 1: update 테스트가 서로 다른 user와 transaction branch를 사용할 수 있도록 fixture를 확장한다.

기존 createAccessToken helper의 sub를 선택값으로 바꾼다. 기존 POST·GET 테스트는 인자를 생략해 user-1을 계속 사용한다.

~~~ts
async function createAccessToken(sub = "user-1") {
  return signAccessToken({
    sub,
    email: sub + "@example.com",
    sid: "session-1",
  });
}
~~~

기존 import에 service의 방어 로직을 직접 검증할 수 있도록 `updateProject`를 추가한다.

~~~ts
import { updateProject } from "@/services/project.service";
~~~

기존 project fixture 아래에 멤버십 조회, project 조회, update query를 분리한 helper를 추가한다.

~~~ts
function mockProjectUpdateTransaction({
  membershipRows = [{ role: "owner" }],
  projectRows = [{ id: createdProject.id, creatorId: "user-2" }],
  updatedProjectRows = [
    {
      ...createdProject,
      name: "Updated Campaign",
      description: "Updated description",
      updatedAt: new Date("2026-09-08T00:05:00.000Z"),
    },
  ],
  membershipError,
  projectError,
  updateError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  updatedProjectRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  updateError?: Error;
} = {}) {
  const membershipQuery = {
    from: vi.fn().mockReturnThis(),
    where: membershipError
      ? vi.fn().mockRejectedValue(membershipError)
      : vi.fn().mockResolvedValue(membershipRows),
  };
  const projectQuery = {
    from: vi.fn().mockReturnThis(),
    where: projectError
      ? vi.fn().mockRejectedValue(projectError)
      : vi.fn().mockResolvedValue(projectRows),
  };
  const projectUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: updateError
      ? vi.fn().mockRejectedValue(updateError)
      : vi.fn().mockResolvedValue(updatedProjectRows),
  };
  const transaction = {
    select: vi.fn()
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(projectQuery),
    update: vi.fn().mockReturnValue(projectUpdate),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectQuery, projectUpdate, transaction };
}
~~~

- [x] Step 2: Owner와 Creator Member의 성공 테스트를 작성한다.

기존 project.test.ts의 GET describe 블록 뒤에 PATCH describe 블록을 추가한다. Owner 테스트는 타인 project의 name과 description을 함께 수정하고, response body가 update returning()의 전체 project 행을 ISO date로 직렬화해 반환하는지 확인한다.

~~~ts
describe("PATCH /workspaces/:workspaceId/projects/:projectId", () => {
  it("allows an owner to update any project name and description", async () => {
    const { projectUpdate } = mockProjectUpdateTransaction();

    const response = await request(createApp())
      .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()))
      .send({
        name: "  Updated Campaign  ",
        description: "  Updated description  ",
      });

    expect(response.status).toBe(200);
    expect(response.body.project).toEqual({
      ...createdProject,
      name: "Updated Campaign",
      description: "Updated description",
      createdAt: createdProject.createdAt.toISOString(),
      updatedAt: "2026-09-08T00:05:00.000Z",
    });
    expect(projectUpdate.set).toHaveBeenCalledWith({
      name: "Updated Campaign",
      description: "Updated description",
      updatedAt: expect.any(Date),
    });
  });

  it("allows a creator member to update only the description", async () => {
    const { projectUpdate } = mockProjectUpdateTransaction({
      membershipRows: [{ role: "member" }],
      projectRows: [{ id: createdProject.id, creatorId: "user-1" }],
      updatedProjectRows: [
        {
          ...createdProject,
          description: "Updated description",
          updatedAt: new Date("2026-09-08T00:05:00.000Z"),
        },
      ],
    });

    const response = await request(createApp())
      .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()))
      .send({ description: "  Updated description  " });

    expect(response.status).toBe(200);
    expect(projectUpdate.set).toHaveBeenCalledWith({
      description: "Updated description",
      updatedAt: expect.any(Date),
    });
  });

  it("allows a creator member to update only the name", async () => {
    const { projectUpdate } = mockProjectUpdateTransaction({
      membershipRows: [{ role: "member" }],
      projectRows: [{ id: createdProject.id, creatorId: "user-1" }],
    });

    const response = await request(createApp())
      .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()))
      .send({ name: "  Updated Campaign  " });

    expect(response.status).toBe(200);
    expect(projectUpdate.set).toHaveBeenCalledWith({
      name: "Updated Campaign",
      updatedAt: expect.any(Date),
    });
  });
});
~~~

- [x] Step 3: description 초기화와 입력 실패 테스트를 추가한다.

같은 PATCH describe 안에서 다음 동작을 테스트한다.

~~~ts
it.each([null, "   "])(
  "normalizes description %j to null",
  async (description) => {
    const { projectUpdate } = mockProjectUpdateTransaction();

    const response = await request(createApp())
      .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()))
      .send({ description });

    expect(response.status).toBe(200);
    expect(projectUpdate.set).toHaveBeenCalledWith({
      description: null,
      updatedAt: expect.any(Date),
    });
  },
);

it("returns 400 for an empty PATCH body", async () => {
  const response = await request(createApp())
    .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
    .set("Authorization", "Bearer " + (await createAccessToken()))
    .send({});

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe("VALIDATION_ERROR");
  expect(db.transaction).not.toHaveBeenCalled();
});

it("rejects an empty service update before opening a transaction", async () => {
  db.transaction.mockClear();

  await expect(
    updateProject({
      workspaceId,
      projectId: createdProject.id,
      userId: "user-1",
    }),
  ).rejects.toMatchObject({
    status: 400,
    code: "VALIDATION_ERROR",
  });

  expect(db.transaction).not.toHaveBeenCalled();
});

it.each([
  { label: "invalid workspace id", path: "not-a-uuid/projects/" + createdProject.id },
  { label: "invalid project id", path: workspaceId + "/projects/not-a-uuid" },
  {
    label: "invalid name",
    path: workspaceId + "/projects/" + createdProject.id,
    body: { name: "   " },
  },
  {
    label: "null name",
    path: workspaceId + "/projects/" + createdProject.id,
    body: { name: null },
  },
  {
    label: "invalid description type",
    path: workspaceId + "/projects/" + createdProject.id,
    body: { description: 123 },
  },
  {
    label: "description longer than 200 characters",
    path: workspaceId + "/projects/" + createdProject.id,
    body: { description: "a".repeat(201) },
  },
])("returns 400 for $label", async ({ path, body }) => {
  const response = await request(createApp())
    .patch("/workspaces/" + path)
    .set("Authorization", "Bearer " + (await createAccessToken()))
    .send(body);

  expect(response.status).toBe(400);
  expect(response.body.error.code).toBe("VALIDATION_ERROR");
  expect(db.transaction).not.toHaveBeenCalled();
});
~~~

- [x] Step 4: 권한·미존재·DB 오류 테스트를 추가한다.

다음 테스트를 같은 describe에 추가한다.

~~~ts
it("returns 401 without authentication", async () => {
  const response = await request(createApp()).patch(
    "/workspaces/" + workspaceId + "/projects/" + createdProject.id,
  );

  expect(response.status).toBe(401);
  expect(response.body.error.code).toBe("UNAUTHORIZED");
  expect(db.transaction).not.toHaveBeenCalled();
});

it("returns 404 and skips project lookup for a non-member", async () => {
  const { projectQuery, projectUpdate } = mockProjectUpdateTransaction({
    membershipRows: [],
  });

  const response = await request(createApp())
    .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
    .set("Authorization", "Bearer " + (await createAccessToken()))
    .send({ name: "Updated Campaign" });

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  expect(projectQuery.where).not.toHaveBeenCalled();
  expect(projectUpdate.set).not.toHaveBeenCalled();
});

it("returns 404 when the project is not in the requested workspace", async () => {
  const { projectUpdate } = mockProjectUpdateTransaction({ projectRows: [] });

  const response = await request(createApp())
    .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
    .set("Authorization", "Bearer " + (await createAccessToken()))
    .send({ name: "Updated Campaign" });

  expect(response.status).toBe(404);
  expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
  expect(projectUpdate.set).not.toHaveBeenCalled();
});

it("returns 403 when a member did not create the project", async () => {
  const { projectUpdate } = mockProjectUpdateTransaction({
    membershipRows: [{ role: "member" }],
    projectRows: [{ id: createdProject.id, creatorId: "user-2" }],
  });

  const response = await request(createApp())
    .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
    .set("Authorization", "Bearer " + (await createAccessToken()))
    .send({ name: "Updated Campaign" });

  expect(response.status).toBe(403);
  expect(response.body.error.code).toBe("PROJECT_UPDATE_FORBIDDEN");
  expect(projectUpdate.set).not.toHaveBeenCalled();
});
~~~

~~~ts
it("returns 500 and stops after a membership query error", async () => {
  const { projectQuery, projectUpdate } = mockProjectUpdateTransaction({
    membershipError: new Error("membership query failed"),
  });

  const response = await request(createApp())
    .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
    .set("Authorization", "Bearer " + (await createAccessToken()))
    .send({ name: "Updated Campaign" });

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  expect(projectQuery.where).not.toHaveBeenCalled();
  expect(projectUpdate.set).not.toHaveBeenCalled();
});

it("returns 500 and stops before update after a project query error", async () => {
  const { projectUpdate } = mockProjectUpdateTransaction({
    projectError: new Error("project query failed"),
  });

  const response = await request(createApp())
    .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
    .set("Authorization", "Bearer " + (await createAccessToken()))
    .send({ name: "Updated Campaign" });

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  expect(projectUpdate.set).not.toHaveBeenCalled();
});

it("returns 500 when the update query fails", async () => {
  const { projectUpdate } = mockProjectUpdateTransaction({
    updateError: new Error("project update failed"),
  });

  const response = await request(createApp())
    .patch("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
    .set("Authorization", "Bearer " + (await createAccessToken()))
    .send({ name: "Updated Campaign" });

  expect(response.status).toBe(500);
  expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  expect(projectUpdate.set).toHaveBeenCalledWith({
    name: "Updated Campaign",
    updatedAt: expect.any(Date),
  });
});

~~~

- [x] Step 5: PATCH 테스트를 실행해 RED를 확인한다.

~~~bash
pnpm --dir backend exec vitest run tests/project.test.ts --no-file-parallelism --maxWorkers=1
~~~

기대 결과: 기존 POST·GET 테스트는 통과하고 새 PATCH 테스트는 route가 아직 등록되지 않아 실패한다. 실패 원인이 기능 부재인지 확인하고 테스트 mock 또는 문법 오류가 있으면 구현 전에 수정한다.

- [x] Step 6: 테스트 포맷과 diff 공백을 확인한다.

~~~bash
pnpm --dir backend exec prettier --check tests/project.test.ts
git diff --check
~~~

기대 결과: 테스트 파일의 Prettier와 공백 검사가 통과한다.

## Task 2: 오류 메시지와 partial update schema 구현

**Files:**

- Modify: backend/src/constants/messages.ts
- Modify: backend/src/schemas/project.schema.ts
- Test: backend/tests/project.test.ts

**Interfaces:**

- Consumes: Task 1의 입력 실패 테스트와 기존 projectNameSchema
- Produces: projectUpdateParamsSchema, updateProjectSchema, updateProjectDescriptionSchema와 네 가지 새 오류 메시지

- [x] Step 1: 프로젝트 수정 메시지를 추가한다.

backend/src/constants/messages.ts의 project 관련 메시지 뒤에 다음 항목을 추가한다.

~~~ts
PROJECT_ID_INVALID: "유효하지 않은 프로젝트 ID입니다",
PROJECT_NOT_FOUND: "프로젝트를 찾을 수 없습니다",
PROJECT_UPDATE_FORBIDDEN: "프로젝트를 수정할 권한이 없습니다",
PROJECT_UPDATE_FIELDS_REQUIRED: "수정할 프로젝트 정보를 입력해주세요",
~~~

- [x] Step 2: description schema를 생성용과 수정용으로 분리한다.

backend/src/schemas/project.schema.ts의 기존 projectDescriptionSchema를 다음 구조로 바꾼다. projectDescriptionValueSchema가 문자열·trim·최대 길이를 담당하고, createProjectDescriptionSchema는 undefined를 null로 바꾸며 updateProjectDescriptionSchema는 undefined를 유지한다.

~~~ts
const projectDescriptionValueSchema = z
  .string({ error: ERROR_MESSAGES.PROJECT_DESCRIPTION_INVALID })
  .trim()
  .max(200, ERROR_MESSAGES.PROJECT_DESCRIPTION_TOO_LONG)
  .nullable();

const createProjectDescriptionSchema = projectDescriptionValueSchema
  .optional()
  .transform((description) => description || null);

const updateProjectDescriptionSchema = projectDescriptionValueSchema
  .optional()
  .transform((description) => {
    if (description === undefined) {
      return undefined;
    }

    return description || null;
  });
~~~

기존 createProjectSchema의 description에는 createProjectDescriptionSchema를 연결한다.

- [x] Step 3: update path와 body schema를 추가한다.

~~~ts
export const projectUpdateParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }),
});

export const updateProjectSchema = z
  .object({
    name: projectNameSchema.optional(),
    description: updateProjectDescriptionSchema,
  })
  .refine(
    ({ name, description }) =>
      name !== undefined || description !== undefined,
    {
      message: ERROR_MESSAGES.PROJECT_UPDATE_FIELDS_REQUIRED,
    },
  );
~~~

기존 projectParamsSchema와 createProjectSchema의 외부 이름과 동작은 유지한다. update schema는 빈 body를 거부하고 description 생략을 undefined로 전달한다.

- [x] Step 4: schema와 기존 API 회귀를 확인한다.

~~~bash
pnpm --dir backend exec tsc --noEmit
pnpm --dir backend exec vitest run tests/project.test.ts --no-file-parallelism --maxWorkers=1
~~~

기대 결과: 타입 검사는 통과하고, PATCH 테스트는 route·controller·service가 아직 연결되지 않아 RED이며 기존 POST·GET 테스트는 통과한다.

## Task 3: transaction 기반 updateProject service 구현

**Files:**

- Modify: backend/src/services/project.service.ts
- Test: backend/tests/project.test.ts

**Interfaces:**

- Consumes: Task 1의 transaction mock, Task 2의 오류 메시지와 normalized partial input
- Produces: UpdateProjectInput, updateProject(input)

- [x] Step 1: service input type을 추가한다.

~~~ts
export interface UpdateProjectInput {
  workspaceId: string;
  projectId: string;
  userId: string;
  name?: string;
  description?: string | null;
}
~~~

- [x] Step 2: 빈 partial input을 transaction 전에 거부한다.

updateProject 함수는 db.transaction을 호출하기 전에 name과 description이 모두 undefined인지 검사한다.

~~~ts
if (name === undefined && description === undefined) {
  throw new HttpError(
    400,
    "VALIDATION_ERROR",
    ERROR_MESSAGES.PROJECT_UPDATE_FIELDS_REQUIRED,
  );
}
~~~

controller schema가 이 상태를 차단하지만 service에도 같은 guard를 둬 직접 호출이 DB query를 실행하지 않게 한다.

- [x] Step 3: membership과 project를 transaction 안에서 조회한다.

membership 조회는 workspaceId와 userId 조건으로 role만 선택한다. membership이 없으면 project query를 실행하지 않고 WORKSPACE_NOT_FOUND를 던진다.

~~~ts
const [membership] = await tx
  .select({ role: workspaceMemberships.role })
  .from(workspaceMemberships)
  .where(
    and(
      eq(workspaceMemberships.workspaceId, workspaceId),
      eq(workspaceMemberships.userId, userId),
    ),
  );

if (!membership) {
  throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
}
~~~

membership 이후에는 projectId와 workspaceId가 모두 일치하는 project의 id와 creatorId를 조회한다.

~~~ts
const [project] = await tx
  .select({ id: projects.id, creatorId: projects.creatorId })
  .from(projects)
  .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));

if (!project) {
  throw new HttpError(404, "PROJECT_NOT_FOUND", ERROR_MESSAGES.PROJECT_NOT_FOUND);
}
~~~

- [x] Step 4: Owner·Creator 권한과 partial update를 구현한다.

Member가 다른 사용자의 project를 수정하지 못하게 한다.

~~~ts
if (membership.role !== "owner" && project.creatorId !== userId) {
  throw new HttpError(
    403,
    "PROJECT_UPDATE_FORBIDDEN",
    ERROR_MESSAGES.PROJECT_UPDATE_FORBIDDEN,
  );
}
~~~

권한을 통과하면 전달된 필드만 updateValues에 넣고 updatedAt을 추가한다.

~~~ts
const updateValues: {
  name?: string;
  description?: string | null;
  updatedAt: Date;
} = {
  updatedAt: new Date(),
};

if (name !== undefined) {
  updateValues.name = name;
}

if (description !== undefined) {
  updateValues.description = description;
}
~~~

이 값을 projectId와 workspaceId 조건의 update returning()에 전달한다.

~~~ts
const [updatedProject] = await tx
  .update(projects)
  .set(updateValues)
  .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
  .returning();

if (!updatedProject) {
  throw new HttpError(404, "PROJECT_NOT_FOUND", ERROR_MESSAGES.PROJECT_NOT_FOUND);
}

return updatedProject;
~~~

전체 함수는 db.transaction(async (tx) => { ... }) 안에서 실행한다. update 값에는 workspaceId, creatorId, description의 기존 값 또는 createdAt을 임의로 넣지 않는다. description은 전달된 경우에만 updateValues에 넣는다.

- [x] Step 5: service 타입 검사와 기존 테스트를 실행한다.

~~~bash
pnpm --dir backend exec tsc --noEmit
pnpm --dir backend exec vitest run tests/project.test.ts --no-file-parallelism --maxWorkers=1
~~~

기대 결과: TypeScript 오류가 없고 기존 POST·GET 테스트는 통과한다. PATCH 테스트는 controller와 route가 아직 연결되지 않아 RED다.

## Task 4: controller와 route 연결

**Files:**

- Modify: backend/src/controllers/project.controller.ts
- Modify: backend/src/routes/project.routes.ts
- Test: backend/tests/project.test.ts

**Interfaces:**

- Consumes: projectUpdateParamsSchema, updateProjectSchema, updateProject, requireUser
- Produces: 인증된 PATCH /workspaces/:workspaceId/projects/:projectId API

- [x] Step 1: controller import와 updateProjectHandler를 추가한다.

기존 controller import에 projectUpdateParamsSchema와 updateProjectSchema를 추가하고 service import에 updateProject를 추가한다. handler는 인증 → path parse → body parse → service call 순서를 따른다.

~~~ts
export async function updateProjectHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId } = parseOrThrow(
    projectUpdateParamsSchema,
    req.params,
  );
  const { name, description } = parseOrThrow(updateProjectSchema, req.body);

  const project = await updateProject({
    workspaceId,
    projectId,
    userId: user.sub,
    name,
    description,
  });

  res.status(200).json({ project });
}
~~~

- [x] Step 2: projectRouter에 PATCH route를 등록한다.

기존 router import에 updateProjectHandler를 추가하고 다음 route를 GET·POST와 같은 파일에 등록한다.

~~~ts
projectRouter.patch("/:projectId", authenticate, asyncHandler(updateProjectHandler));
~~~

Router({ mergeParams: true })와 routes/index.ts의 workspace mount는 유지한다.

- [x] Step 3: PATCH 집중 테스트를 GREEN으로 만든다.

~~~bash
pnpm --dir backend exec vitest run tests/project.test.ts --no-file-parallelism --maxWorkers=1
~~~

기대 결과: project.test.ts의 생성·목록·수정 테스트가 모두 통과한다. Owner·Creator partial update, description 초기화, empty body, 401·403·404·500 계약과 updateValues 필드 제한이 검증된다.

## Task 5: 전체 검증과 계획 결과 기록

**Files:**

- Verify: backend/tests/project.test.ts
- Verify: backend/src/constants/messages.ts
- Verify: backend/src/schemas/project.schema.ts
- Verify: backend/src/services/project.service.ts
- Verify: backend/src/controllers/project.controller.ts
- Verify: backend/src/routes/project.routes.ts
- Verify unchanged: backend/src/db/schema/projects.ts, backend/src/db/migrations/**, backend/src/routes/index.ts

**Interfaces:**

- Consumes: Task 4의 완성된 PATCH API
- Produces: 검증 결과와 계획 대비 실제 구현 기록

- [x] Step 1: project 집중 테스트를 실행한다.

~~~bash
pnpm --dir backend exec vitest run tests/project.test.ts --no-file-parallelism --maxWorkers=1
~~~

기대 결과: project 생성·목록·수정 테스트가 모두 통과한다.

- [x] Step 2: backend 전체 테스트를 실행한다.

~~~bash
pnpm --dir backend exec vitest run --no-file-parallelism --maxWorkers=1
~~~

기대 결과: 기존 테스트와 새 PATCH 테스트가 모두 통과한다.

- [x] Step 3: lint와 TypeScript build를 실행한다.

~~~bash
pnpm --dir backend lint
pnpm --dir backend build
~~~

기대 결과: lint 오류와 build 오류가 없다.

- [x] Step 4: format과 diff 공백을 검사한다.

~~~bash
pnpm --dir backend exec prettier --check src tests
git diff --check
~~~

기대 결과: Prettier와 diff 공백 검사가 통과한다.

- [x] Step 5: 변경 범위와 migration 미변경을 확인한다.

~~~bash
git status --short
git diff --stat
git diff -- backend/src/db/schema/projects.ts backend/src/db/migrations backend/src/routes/index.ts
~~~

기대 결과: 계획의 애플리케이션 파일과 project.test.ts만 변경되고 schema, migration, route index에는 변경이 없다. 사용자가 commit을 요청하지 않았으므로 commit·push·merge는 실행하지 않는다.

- [x] Step 6: 계획 문서에 Implementation Results를 추가한다.

모든 검증이 끝난 뒤 이 문서 마지막에 다음 네 항목을 실제 관찰값으로 작성한다.

1. 실제 변경 내용: 변경한 파일과 각 파일의 동작
2. 계획과 달라진 점: 차이가 없으면 없다고 명시하고, 차이가 있으면 이유와 영향 기록
3. 실행한 검증 명령과 결과: 명령별 통과 여부와 테스트 수
4. 남은 후속 작업: 없으면 없다고 명시하고, 있으면 구체적인 작업과 담당 범위 기록

관찰하지 않은 결과나 추정값을 Implementation Results에 작성하지 않는다.

## Self-Review Checklist

- [x] design 문서의 모든 수용 기준이 Task 1~4의 테스트 또는 구현 단계에 대응한다.
- [x] name 생략은 기존 값 유지이고, name null·공백은 400으로 처리된다.
- [x] description 생략은 기존 값 유지이고, null·공백은 null로 처리된다.
- [x] 빈 body는 schema와 service 양쪽에서 거부된다.
- [x] Owner는 모든 같은 workspace project를 수정하고, Member는 Creator project만 수정한다.
- [x] 비멤버는 project query 전에 WORKSPACE_NOT_FOUND로 종료된다.
- [x] project query와 update에 workspaceId 조건이 함께 들어간다.
- [x] updateValues에는 name, description, updatedAt 외의 필드가 들어가지 않는다.
- [x] 성공 응답은 project 목록이 아니라 수정된 project 객체 하나 전체다.
- [x] 기존 createProjectSchema의 description 누락·null·공백 동작이 유지된다.
- [x] DB schema와 migration 변경이 없다.
- [x] 구현 계획에는 commit 단계가 없으며 commit은 사용자 요청 후에만 수행한다.

## Implementation Results

### 실제 변경 내용

- `backend/src/constants/messages.ts`: 프로젝트 수정 path ID, 미존재, 권한, 빈 수정 body 오류 메시지를 추가했다.
- `backend/src/schemas/project.schema.ts`: 생성용 description 정규화 동작을 유지하면서 수정용 description의 생략 보존·null/공백 초기화를 분리했고, 수정 path/body schema를 추가했다.
- `backend/src/services/project.service.ts`: transaction 기반 `updateProject`를 추가해 멤버십, project workspace 소속, Owner/Creator 권한을 확인하고 전달된 필드와 `updatedAt`만 갱신한다.
- `backend/src/controllers/project.controller.ts`, `backend/src/routes/project.routes.ts`: 인증된 PATCH handler와 `/workspaces/:workspaceId/projects/:projectId` route를 연결했다.
- `backend/tests/project.test.ts`: Owner·Creator 성공, 부분 수정, description 초기화, 입력·인증·권한·미존재·DB 오류와 query 경계를 검증하는 테스트를 추가했다.

### 계획과 달라진 점

- 기능 동작과 파일 범위의 차이는 없다.
- 실행 중 계획 문서의 DB 오류 테스트 예시가 코드 블록 밖에 있던 문서 형식만 보정했다.
- 전체 `prettier --check src tests`는 기존 변경과 무관한 `backend/src/db/migrations/meta/0000_snapshot.json`과 `backend/src/scripts/create-test-user.ts` 때문에 실패했다. 구현 변경 파일만 별도 검사했을 때는 통과했으며, 두 기존 파일은 수정하지 않았다.

### 실행한 검증 명령과 결과

- `pnpm --dir backend exec vitest run tests/project.test.ts --no-file-parallelism --maxWorkers=1 --silent`: 통과, 1개 파일·52개 테스트.
- `pnpm --dir backend exec vitest run --no-file-parallelism --maxWorkers=1 --silent`: 통과, 20개 파일·161개 테스트.
- `pnpm --dir backend exec tsc --noEmit`: 통과.
- `pnpm --dir backend lint`: 통과.
- `pnpm --dir backend build`: 통과.
- 변경 파일 대상 `pnpm --dir backend exec prettier --check ...`: 통과.
- 전체 `pnpm --dir backend exec prettier --check src tests`: 기존 파일 2개로 실패.
- `git diff --check`: 통과.

### 남은 후속 작업

- 프로젝트 수정 기능 범위의 후속 작업은 없다.
- 저장소 기존 포맷 오류 2개는 이번 기능과 무관하므로 별도 정리 작업으로 남긴다.
- 사용자가 commit을 요청하지 않았으므로 commit·push·merge는 실행하지 않았다.
