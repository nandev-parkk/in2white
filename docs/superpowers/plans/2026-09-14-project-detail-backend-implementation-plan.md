# 프로젝트 상세 조회 백엔드 구현 계획

> **에이전트 실행 지침:** `superpowers:executing-plans`와 `test-driven-development`를 적용해 현재 에이전트가 Direct 방식으로 수행한다. 체크박스로 작업 상태를 기록하며 사용자 요청 없이 commit하지 않는다.

**목표:** 인증된 워크스페이스 멤버가 활성 프로젝트의 기본 정보와 생성자를 단건 조회한다.

**구조:** 기존 프로젝트 route·controller·service를 확장한다. 컨트롤러는 기존 UUID 검증과 인증을 사용하고, 서비스는 멤버십 확인 후 활성 프로젝트와 생성자를 조회한다. HTTP 계약과 실제 PostgreSQL 조회 동작을 별도 테스트한다.

**기술:** Express, TypeScript, Drizzle ORM, Zod, Vitest, Supertest, Testcontainers, pnpm.

**설계:** [프로젝트 상세 조회 백엔드 설계](../specs/2026-09-14-project-detail-backend-design.md)

## 상태와 제약

- 상태: 2026-09-14 사용자 승인 후 이슈 #54 연결, 구현·독립 리뷰·검증 완료.
- 작업 유형 / 프로필 / 실행 방식: Feature / Deep / Direct.
- 작업 경로: `/Users/nandev/orca/workspaces/in2white/feature-project-detail-backend`
- 브랜치: `feature/project-detail-backend`
- 기준 commit: `4b50edd8009f9a50ff27ac9d06411a941624449a`
- 이후 명령은 작업 경로에서 실행한다.
- 성공 계약: `GET /workspaces/:workspaceId/projects/:projectId` → `200 { project }`.
- 권한: Owner와 모든 Member. 비멤버는 `404 WORKSPACE_NOT_FOUND`.
- 없는·타 워크스페이스·삭제된 프로젝트는 `404 PROJECT_NOT_FOUND`.
- 공개 응답은 기존 `ProjectListItem` 구조와 같다. 문서 목록·문서 수·내부 삭제 상태·사용자 비공개 필드는 포함하지 않는다.
- DB 스키마·새 migration·프론트엔드·기존 다른 API 계약은 변경하지 않는다.
- production 구현은 승인 및 이슈 연결 후 수행했다. 후속 사용자 요청에 따라 commit·push·PR 생성·merge를 진행한다.

## 이슈 구성과 발행 절차

이 결과물은 단건 API 하나이므로 GitHub 이슈 1건으로 추적한다. 대상은 `https://github.com/nandev-parkk/in2white`다.

**발행 제목:** 프로젝트 상세 조회 백엔드 API 구현

**최초 발행 본문:**

```markdown
## 목표

프로젝트 상세 화면에서 이름·설명·생성자를 단건 조회할 수 있는 인증 API를 추가한다.

## 범위

- GET /workspaces/:workspaceId/projects/:projectId
- 기존 목록 항목과 같은 프로젝트 메타데이터 및 creator 반환
- Owner/Member 조회 허용, 비멤버 404
- 미존재·타 워크스페이스·소프트 삭제 프로젝트 404
- HTTP 계약 및 실제 PostgreSQL 접근 범위 테스트
- 백엔드 README와 설계·구현 계획 기록

## 완료 조건

- 인증·UUID·리소스·DB 오류 계약이 설계와 일치한다.
- 문서가 없어도 프로젝트 조회에 성공한다.
- deletedAt과 생성자의 비공개 정보가 응답에 없다.
- 관련 통합 테스트, 전체 백엔드 테스트, lint, build, 포맷 검사를 통과한다.
- 실제 구현·계획 차이·검증 결과·후속 작업을 구현 계획에 기록한다.

## 관련 문서

- docs/superpowers/specs/2026-09-14-project-detail-backend-design.md
- docs/superpowers/plans/2026-09-14-project-detail-backend-implementation-plan.md
```

- [x] 승인 범위를 확인하고 GitHub 인증·대상 저장소·중복 이슈를 다시 확인한다.
- [x] 승인된 본문을 `/tmp/in2white-project-detail-issue.md`에 쓰고 `gh issue create --repo nandev-parkk/in2white --title '프로젝트 상세 조회 백엔드 API 구현' --body-file /tmp/in2white-project-detail-issue.md`로 발행한다.
- [x] 반환된 이슈 번호·URL을 이 문서에 기록하고 Orca worktree에 연결한다.

이슈: [#54 프로젝트 상세 조회 백엔드 API 구현](https://github.com/nandev-parkk/in2white/issues/54).

## 작업 1: HTTP 계약의 실패 테스트

**생성:** `backend/tests/project-detail.test.ts`

기존 `backend/tests/project.test.ts`는 이미 1,000줄 이상이므로 상세 조회 테스트를 별도 파일로 둔다. 이 파일은 조회 서비스를 대체해 HTTP 경계만 검증하고, 실제 조회 조건은 작업 2에서 검증한다.

- [x] 다음 테스트 파일을 작성한다.

```ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "@/app";
import { signAccessToken } from "@/lib/jwt";
import { getProjectDetail } from "@/services/project.service";
import { HttpError } from "@/utils/http-error";

vi.mock("@/services/project.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/services/project.service")>();
  return { ...actual, getProjectDetail: vi.fn() };
});

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const userId = "7a1e6679-7425-40de-944b-e07fc1f90ae7";
const url = "/workspaces/" + workspaceId + "/projects/" + projectId;
const project = {
  id: projectId,
  workspaceId,
  name: "브랜드 캠페인",
  description: "프로젝트 설명",
  creatorId: userId,
  creator: { id: userId, name: "작성자" },
  createdAt: new Date("2026-09-14T00:00:00.000Z"),
  updatedAt: new Date("2026-09-14T00:05:00.000Z"),
};

async function token() {
  return signAccessToken({
    sub: userId,
    email: "member@example.test",
    sid: "test-session",
    ver: 0,
  });
}

beforeEach(() => {
  vi.mocked(getProjectDetail).mockReset();
  vi.mocked(getProjectDetail).mockResolvedValue(project);
});

describe("프로젝트 상세 조회 HTTP 계약", () => {
  it("프로젝트와 생성자를 ISO 날짜와 함께 반환한다", async () => {
    const response = await request(createApp())
      .get(url)
      .set("Authorization", "Bearer " + (await token()));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      project: {
        ...project,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    });
    expect(getProjectDetail).toHaveBeenCalledWith({
      workspaceId,
      projectId,
      userId,
    });
  });

  it("설명이 없으면 null을 유지한다", async () => {
    vi.mocked(getProjectDetail).mockResolvedValue({
      ...project,
      description: null,
    });
    const response = await request(createApp())
      .get(url)
      .set("Authorization", "Bearer " + (await token()));
    expect(response.status).toBe(200);
    expect(response.body.project.description).toBeNull();
  });

  it.each([undefined, "Basic invalid", "Bearer invalid"])(
    "인증 헤더 %s는 401이며 서비스를 호출하지 않는다",
    async (authorization) => {
      const pending = request(createApp()).get(url);
      if (authorization !== undefined)
        pending.set("Authorization", authorization);
      const response = await pending;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
      expect(getProjectDetail).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/workspaces/invalid/projects/" + projectId,
    "/workspaces/" + workspaceId + "/projects/invalid",
  ])("잘못된 UUID 경로 %s는 400이다", async (path) => {
    const response = await request(createApp())
      .get(path)
      .set("Authorization", "Bearer " + (await token()));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(getProjectDetail).not.toHaveBeenCalled();
  });

  it.each(["WORKSPACE_NOT_FOUND", "PROJECT_NOT_FOUND"])(
    "%s 도메인 오류를 404로 전달한다",
    async (code) => {
      vi.mocked(getProjectDetail).mockRejectedValue(
        new HttpError(404, code, "리소스를 찾을 수 없습니다."),
      );
      const response = await request(createApp())
        .get(url)
        .set("Authorization", "Bearer " + (await token()));
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe(code);
    },
  );

  it("예상하지 못한 DB 오류의 상세를 숨기고 500을 반환한다", async () => {
    const internalMessage = "테스트용 내부 DB 오류";
    vi.mocked(getProjectDetail).mockRejectedValue(new Error(internalMessage));
    const response = await request(createApp())
      .get(url)
      .set("Authorization", "Bearer " + (await token()));
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(response.body)).not.toContain(internalMessage);
  });
});
```

- [x] 실패 상태를 확인한다.

```bash
pnpm --dir backend exec vitest run tests/project-detail.test.ts --reporter=dot
```

기대: 새 route가 없어 성공 기대 테스트가 404로 실패한다. 테스트 문법·환경 실패와 구분해 결과를 기록한다.

## 작업 2: 실제 PostgreSQL 접근 범위의 실패 테스트

**생성:** `backend/tests/project-detail.integration.test.ts`

기존 Testcontainers와 migration을 재사용한다. DB 연결만 테스트 DB로 바꾸고 인증된 HTTP 요청으로 실제 route·controller·service·Drizzle query를 실행한다. 이를 통해 잘못된 WHERE 조건이나 응답 projection으로 인한 정보 노출을 실제 데이터로 검증한다.

- [x] 다음 통합 테스트를 작성한다.

```ts
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Express } from "express";
import postgres, { type Sql } from "postgres";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";

const integration =
  process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

const ownerId = randomUUID();
const creatorId = randomUUID();
const memberId = randomUUID();
const outsiderId = randomUUID();
const workspaceId = randomUUID();
const otherWorkspaceId = randomUUID();
const activeProjectId = randomUUID();
const deletedProjectId = randomUUID();
const otherProjectId = randomUUID();
const emptyDescriptionProjectId = randomUUID();
const missingId = randomUUID();
const timestamp = new Date("2026-09-14T00:00:00.000Z");

integration("프로젝트 상세 조회 PostgreSQL 계약", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let sql: Sql | undefined;
  let database: PostgresJsDatabase<typeof schema>;
  let app: Express;

  async function getProject(
    projectId = activeProjectId,
    userId = memberId,
    targetWorkspaceId = workspaceId,
  ) {
    const accessToken = await signAccessToken({
      sub: userId,
      email: userId + "@example.test",
      sid: "integration-test-session",
      ver: 0,
    });

    return request(app)
      .get("/workspaces/" + targetWorkspaceId + "/projects/" + projectId)
      .set("Authorization", "Bearer " + accessToken);
  }

  beforeAll(async () => {
    const image = process.env.TEST_POSTGRES_IMAGE ?? "postgres:17-alpine";
    container = await new PostgreSqlContainer(image).start();
    sql = postgres(container.getConnectionUri(), { max: 1 });
    database = drizzle(sql, { schema });
    await migrate(database, {
      migrationsFolder: fileURLToPath(
        new URL("../src/db/migrations", import.meta.url),
      ),
    });

    await database.insert(schema.users).values(
      [
        { id: ownerId, name: "소유자" },
        { id: creatorId, name: "작성자" },
        { id: memberId, name: "일반 멤버" },
        { id: outsiderId, name: "다른 워크스페이스 소유자" },
      ].map((user) => ({
        ...user,
        email: user.id + "@example.test",
        passwordHash: "test-only-unused-password-hash",
      })),
    );
    await database.insert(schema.workspaces).values([
      { id: workspaceId, name: "대상 워크스페이스", ownerId },
      { id: otherWorkspaceId, name: "다른 워크스페이스", ownerId: outsiderId },
    ]);
    await database.insert(schema.workspaceMemberships).values([
      { workspaceId, userId: ownerId, role: "owner" },
      { workspaceId, userId: creatorId, role: "member" },
      { workspaceId, userId: memberId, role: "member" },
      { workspaceId: otherWorkspaceId, userId: outsiderId, role: "owner" },
    ]);

    const baseProject = {
      workspaceId,
      name: "브랜드 캠페인",
      description: "프로젝트 설명",
      creatorId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await database.insert(schema.projects).values([
      { ...baseProject, id: activeProjectId },
      { ...baseProject, id: deletedProjectId, deletedAt: timestamp },
      { ...baseProject, id: otherProjectId, workspaceId: otherWorkspaceId },
      { ...baseProject, id: emptyDescriptionProjectId, description: null },
    ]);

    vi.doMock("@/db/client", () => ({ db: database }));
    const { createApp } = await import("@/app");
    app = createApp();
  }, 120_000);

  afterAll(async () => {
    vi.doUnmock("@/db/client");
    try {
      await sql?.end();
    } finally {
      await container?.stop();
    }
  }, 30_000);

  it.each([
    ["소유자", ownerId],
    ["생성자 멤버", creatorId],
    ["생성자가 아닌 멤버", memberId],
  ] as const)(
    "%s가 문서 없는 프로젝트의 공개 정보만 조회한다",
    async (_role, userId) => {
      const response = await getProject(activeProjectId, userId);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        project: {
          id: activeProjectId,
          workspaceId,
          name: "브랜드 캠페인",
          description: "프로젝트 설명",
          creatorId,
          creator: { id: creatorId, name: "작성자" },
          createdAt: "2026-09-14T00:00:00.000Z",
          updatedAt: "2026-09-14T00:00:00.000Z",
        },
      });
    },
  );

  it("설명 null을 유지한다", async () => {
    const response = await getProject(emptyDescriptionProjectId);
    expect(response.status).toBe(200);
    expect(response.body.project.description).toBeNull();
  });

  it.each([
    ["비멤버", workspaceId, outsiderId],
    ["없는 워크스페이스", missingId, memberId],
  ] as const)(
    "%s에게 워크스페이스 정보를 노출하지 않는다",
    async (_case, targetWorkspaceId, userId) => {
      const response = await getProject(
        activeProjectId,
        userId,
        targetWorkspaceId,
      );
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    },
  );

  it.each([
    ["없는 프로젝트", missingId],
    ["다른 워크스페이스 프로젝트", otherProjectId],
    ["삭제된 프로젝트", deletedProjectId],
  ] as const)("%s를 동일한 404로 처리한다", async (_case, projectId) => {
    const response = await getProject(projectId);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("삭제 프로젝트를 요청한 비멤버에게도 워크스페이스 오류를 반환한다", async () => {
    const response = await getProject(deletedProjectId, outsiderId);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
  });

  it("생성자의 현재 이름을 반환하며 조회로 수정 시각을 바꾸지 않는다", async () => {
    await database
      .update(schema.users)
      .set({ name: "변경된 작성자" })
      .where(eq(schema.users.id, creatorId));
    try {
      const response = await getProject();
      expect(response.status).toBe(200);
      expect(response.body.project.creator).toEqual({
        id: creatorId,
        name: "변경된 작성자",
      });
      const [stored] = await database
        .select({ updatedAt: schema.projects.updatedAt })
        .from(schema.projects)
        .where(eq(schema.projects.id, activeProjectId));
      expect(stored.updatedAt).toEqual(timestamp);
    } finally {
      await database
        .update(schema.users)
        .set({ name: "작성자" })
        .where(eq(schema.users.id, creatorId));
    }
  });
});
```

- [x] 실제 DB 테스트의 실패 원인이 미구현 GET route인지 확인한다.

```bash
RUN_DATABASE_INTEGRATION_TESTS=1 pnpm --dir backend exec vitest run tests/project-detail.integration.test.ts --reporter=dot
```

기대: 임시 PostgreSQL 생성과 기존 migration 적용은 성공하고, GET route 미구현으로 반환된 `404 NOT_FOUND` 때문에 새 테스트가 실패한다. Docker 실행 실패를 기능의 실패 테스트로 간주하지 않는다.

## 작업 3: 단건 조회 서비스·컨트롤러·라우트

**수정:** 프로젝트 service, controller, route 3개 파일.

- [x] `backend/src/services/project.service.ts`에 입력 타입과 함수를 추가한다. 아래에서 사용하는 Drizzle 함수·테이블·오류 유틸은 이미 이 파일에서 import하고 있다. `ProjectListItem`도 기존 타입이다.

```ts
export interface GetProjectDetailInput {
  workspaceId: string;
  projectId: string;
  userId: string;
}

export async function getProjectDetail({
  workspaceId,
  projectId,
  userId,
}: GetProjectDetailInput): Promise<ProjectListItem> {
  const [membership] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
      ),
    );

  if (!membership) {
    throw new HttpError(
      404,
      "WORKSPACE_NOT_FOUND",
      ERROR_MESSAGES.WORKSPACE_NOT_FOUND,
    );
  }

  const [project] = await db
    .select({
      id: projects.id,
      workspaceId: projects.workspaceId,
      name: projects.name,
      description: projects.description,
      creatorId: projects.creatorId,
      creator: { id: users.id, name: users.name },
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(users, eq(projects.creatorId, users.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
      ),
    );

  if (!project) {
    throw new HttpError(
      404,
      "PROJECT_NOT_FOUND",
      ERROR_MESSAGES.PROJECT_NOT_FOUND,
    );
  }

  return project;
}
```

- [x] `backend/src/controllers/project.controller.ts`의 기존 서비스 import 목록에 `getProjectDetail`을 추가하고 다음 함수를 추가한다.

```ts
export async function getProjectDetailHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId } = parseOrThrow(
    projectUpdateParamsSchema,
    req.params,
  );
  const project = await getProjectDetail({
    workspaceId,
    projectId,
    userId: user.sub,
  });
  res.status(200).json({ project });
}
```

- [x] `backend/src/routes/project.routes.ts`를 다음과 같이 확장한다.

```ts
import { Router } from "express";
import {
  createProjectHandler,
  deleteProjectHandler,
  getProjectDetailHandler,
  listProjectsHandler,
  updateProjectHandler,
} from "@/controllers/project.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const projectRouter = Router({ mergeParams: true });

projectRouter.get("/", authenticate, asyncHandler(listProjectsHandler));
projectRouter.get(
  "/:projectId",
  authenticate,
  asyncHandler(getProjectDetailHandler),
);
projectRouter.post("/", authenticate, asyncHandler(createProjectHandler));
projectRouter.patch(
  "/:projectId",
  authenticate,
  asyncHandler(updateProjectHandler),
);
projectRouter.delete(
  "/:projectId",
  authenticate,
  asyncHandler(deleteProjectHandler),
);
```

- [x] 관련 테스트와 실제 DB 테스트의 성공을 확인한다.

```bash
pnpm --dir backend exec vitest run tests/project-detail.test.ts tests/project.test.ts tests/whiteboard-document.test.ts --reporter=dot
RUN_DATABASE_INTEGRATION_TESTS=1 pnpm --dir backend exec vitest run tests/project-detail.integration.test.ts --reporter=dot
```

기대: 새 HTTP·DB 테스트와 기존 프로젝트/화이트보드 API 테스트가 모두 통과한다. 하위 `/whiteboard-documents` 경로를 단건 GET이 가로채지 않는 것도 기존 라우트 테스트로 확인한다.

## 작업 4: API 문서·리뷰·최종 검증

**수정:** `backend/README.md`, 본 계획 문서.

- [x] README의 시작 안내 뒤에 다음 내용을 추가한다.

```markdown
## 프로젝트 상세 조회

인증된 워크스페이스 Owner/Member는
`GET /workspaces/:workspaceId/projects/:projectId`로 프로젝트 기본 정보와
`creator: { id, name }`을 조회한다. 성공 응답은 `200 { project }`이며
설명은 null일 수 있다. `Authorization: Bearer <access-token>`이 필요하다.

비멤버·없는 워크스페이스는 `404 WORKSPACE_NOT_FOUND`, 없는·다른
워크스페이스·삭제된 프로젝트는 `404 PROJECT_NOT_FOUND`다.
인증·경로 UUID 오류는 각각 401·400이다.

화이트보드 문서 검색·목록·개수는 기존
`GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents`의
`whiteboardDocuments`와 `pagination.total`을 사용한다.

실제 PostgreSQL 접근 범위 검증은 backend 디렉터리에서
`RUN_DATABASE_INTEGRATION_TESTS=1 pnpm exec vitest run tests/project-detail.integration.test.ts --reporter=dot`
명령으로 실행한다. Testcontainers의 임시 DB를 사용하며 Docker가 필요하다.
기본 이미지는 postgres:17-alpine이고 TEST_POSTGRES_IMAGE로 바꿀 수 있다.
기본 전체 테스트에서는 이 통합 테스트가 제외된다.
```

- [x] 관련 Superpowers 리뷰 절차를 적용하고 멤버십 우선 검증, 활성 프로젝트 조건, 공개 필드, route 충돌, 테스트의 실제 실패 검출 여부를 검토한다. 같은 범위 리뷰는 중복하지 않는다.
- [x] `verification-before-completion`을 적용하고 변경 파일 포맷을 정리한 후 다음 명령을 실행한다.

```bash
pnpm --dir backend test
RUN_DATABASE_INTEGRATION_TESTS=1 pnpm --dir backend exec vitest run tests/project-detail.integration.test.ts --reporter=dot
pnpm --dir backend lint
pnpm --dir backend build
pnpm --dir backend exec prettier --check src/services/project.service.ts src/controllers/project.controller.ts src/routes/project.routes.ts tests/project-detail.test.ts tests/project-detail.integration.test.ts README.md ../docs/superpowers/specs/2026-09-14-project-detail-backend-design.md ../docs/superpowers/plans/2026-09-14-project-detail-backend-implementation-plan.md
git diff --check
```

기대: 모든 관련 검증 통과. build는 TypeScript 검사와 경로 alias 변환을 포함한다. 기존 화이트보드 migration 통합 테스트는 이번 범위의 migration 변경이 없어 별도로 다시 실행하지 않는다. 기본 전체 테스트에서 제외된 수를 통과 수에 합산하지 않는다.

- [x] `git status --short`, `git diff --stat`, 실제 diff로 기능 밖의 변경이 없는지 확인한다.
- [x] 아래 구현 결과에 실제 변경, 계획 차이, 검증 명령·결과, 리뷰 결과와 후속 작업을 기록한다.
- [x] 사용자에게 완료된 범위와 검증 결과를 보고한다.

## Implementation Results (구현 결과)

### 준비 단계에서 완료한 작업

- Orca로 전용 worktree를 만들고 브랜치를 `feature/project-detail-backend`로 확인했다.
- `pnpm --dir backend install --frozen-lockfile --ignore-scripts`에 해당하는 설치를 backend 경로에서 실행했다. 잠금 파일 변경 없이 의존성이 준비되었다.
- `pnpm --dir backend exec vitest run --reporter=dot`: 기존 35개 파일·444개 테스트 통과, PostgreSQL migration 테스트 1개 파일·3개 기본 제외.
- `docker info --format '{{.ServerVersion}}'`: Docker 서버 응답 확인.
- 설계·구현 계획·이슈 본문 초안을 작성했다.
- 문서 자체 검토에서 API·오류·범위와 작업별 검증이 일치하는지 확인했다. 두 문서의 Prettier 검사와 `git diff --check`가 통과했다. 새 문서는 미추적 상태이므로 Markdown 코드 블록 짝과 줄 끝 공백도 별도로 확인한다.
- 기존 `dev` 체크아웃의 미추적 `.idea/`와 별도 `feature/members` 작업 공간은 수정하지 않았다.

### 실제 구현

- `getProjectDetail({ workspaceId, projectId, userId })`가 멤버십 확인 후 요청 워크스페이스의 활성 프로젝트와 생성자를 조회한다.
- `getProjectDetailHandler`와 인증된 `GET /:projectId` route를 연결해 `200 { project }`를 제공한다.
- 기존 `ProjectListItem`과 `projectUpdateParamsSchema`를 재사용했다. DB 스키마·migration·의존성·프론트엔드·다른 API 계약은 변경하지 않았다.
- HTTP 계약 테스트 10개와 실제 PostgreSQL HTTP 통합 테스트 11개를 추가했다. 공개 필드, null 설명, 현재 생성자 이름, 권한·리소스 경계, 조회 시각 보존을 검증한다.
- backend README에 새 API와 통합 테스트 실행 방법을 추가했다.

### 계획과 달라진 점

- API·응답·권한 범위의 변경은 없다.
- 실제 DB 통합 테스트는 서비스 직접 호출 대신 인증 HTTP 요청으로 확장해 route·controller·service·SQL 전체 경로를 검증했다. 이에 맞춰 작업 2의 테스트 코드와 실패 기대 결과를 갱신했다.
- 로컬에 준비된 PostgreSQL 18 이미지를 `TEST_POSTGRES_IMAGE=postgres:18`로 사용했다. 테스트 기본 이미지는 기존 관례인 `postgres:17-alpine`을 유지했다.

### 검증 명령과 결과

모든 명령은 이 작업 worktree 루트에서 실행했다.

| 단계           | 명령                                                                                                                                                                                                                                                                                                                                                                                   | 결과                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTP 실패 확인 | `pnpm --dir backend exec vitest run tests/project-detail.test.ts --reporter=dot`                                                                                                                                                                                                                                                                                                       | 미구현 route의 `404 NOT_FOUND` 때문에 10개 모두 실패. 예상한 실패 확인.                                                                                            |
| DB 실패 확인   | `RUN_DATABASE_INTEGRATION_TESTS=1 TEST_POSTGRES_IMAGE=postgres:18 pnpm --dir backend exec vitest run tests/project-detail.integration.test.ts --reporter=dot`                                                                                                                                                                                                                          | 임시 DB·기존 migration 준비 성공, 미구현 route의 응답 때문에 11개 모두 실패.                                                                                       |
| 관련 회귀      | `pnpm --dir backend exec vitest run tests/project-detail.test.ts tests/project.test.ts tests/whiteboard-document.test.ts --reporter=dot`                                                                                                                                                                                                                                               | 3개 파일·170개 테스트 통과.                                                                                                                                        |
| DB 구현 검증   | `RUN_DATABASE_INTEGRATION_TESTS=1 TEST_POSTGRES_IMAGE=postgres:18 pnpm --dir backend exec vitest run tests/project-detail.integration.test.ts --reporter=dot`                                                                                                                                                                                                                          | PostgreSQL 18에서 11개 통과. 테스트 컨테이너 종료 성공.                                                                                                            |
| 전체 백엔드    | `pnpm --dir backend test`                                                                                                                                                                                                                                                                                                                                                              | 36개 파일·454개 통과, 통합 테스트 2개 파일·14개 기본 제외. 그중 신규 11개는 위 별도 명령으로 통과했고 기존 화이트보드 migration 테스트 3개는 이번 범위에서 미실행. |
| lint           | `pnpm --dir backend lint`                                                                                                                                                                                                                                                                                                                                                              | 통과, 오류·경고 없음.                                                                                                                                              |
| build          | `pnpm --dir backend build`                                                                                                                                                                                                                                                                                                                                                             | TypeScript 검사와 경로 alias 변환 통과.                                                                                                                            |
| 포맷           | `pnpm --dir backend exec prettier --check src/services/project.service.ts src/controllers/project.controller.ts src/routes/project.routes.ts tests/project-detail.test.ts tests/project-detail.integration.test.ts README.md ../docs/superpowers/specs/2026-09-14-project-detail-backend-design.md ../docs/superpowers/plans/2026-09-14-project-detail-backend-implementation-plan.md` | 변경 파일 검사 통과.                                                                                                                                               |
| diff           | `git diff --check`                                                                                                                                                                                                                                                                                                                                                                     | 통과. 신규 파일은 포맷 검사와 줄 끝 공백 확인으로 함께 검증.                                                                                                       |

테스트에서 발생한 4xx·5xx 로그는 오류 계약 검증을 위해 의도적으로 발생시킨 요청이다. 테스트 실패나 미처리 예외가 아니다. 실제 실행한 고유 테스트는 기존 444개와 신규 21개를 합한 465개다.

### 리뷰 결과

- `requesting-code-review`의 독립 리뷰 1회 완료. Critical·Important 문제 없음.
- Minor 1건: 새 테스트 2곳의 `signAccessToken` 입력에서 필수 `ver` 누락. 별도 타입 검사로 `TS2345` 2건을 재현했다.
- 두 테스트에 `ver: 0`을 명시하고 프로덕션 코드·신규 테스트 2개 파일을 함께 타입 검사해 통과했다. 기존 build 설정이 테스트를 포함하지 않으므로 아래 추가 검증을 수행했다.
- 수정 후 `RUN_DATABASE_INTEGRATION_TESTS=1 TEST_POSTGRES_IMAGE=postgres:18 pnpm --dir backend exec vitest run tests/project-detail.test.ts tests/project-detail.integration.test.ts --reporter=dot`: 신규 21개 모두 재통과.
- 수정 파일의 ESLint·Prettier 재검사 통과. 미해결 리뷰 지적 사항 없음.

추가 타입 검사 명령:

```bash
pnpm --dir backend exec node --input-type=module <<'JS'
import ts from 'typescript';
const configFile = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
const program = ts.createProgram({
  rootNames: [...config.fileNames, 'tests/project-detail.test.ts', 'tests/project-detail.integration.test.ts'],
  options: { ...config.options, noEmit: true, rootDir: process.cwd() },
});
const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => String.fromCharCode(10),
  }));
  process.exitCode = 1;
} else {
  console.log('프로덕션 코드와 신규 테스트 2개 파일 타입 검사 통과');
}
JS
```

### 남은 위험과 후속 작업

- 승인된 구현 범위의 미완료 작업과 미해결 리뷰 지적 사항은 없다.
- 실제 DB 검증은 PostgreSQL 18에서 실행했다. 기본 설정의 PostgreSQL 17 이미지는 이번 실행에서 사용하지 않았다.
- 최초 구현 완료 시점에는 변경을 미커밋 상태로 보존했다. 이후 사용자가 PR 생성·merge를 요청하여 검증된 변경의 commit·push와 `dev` 대상 PR 생성·merge를 진행한다. 실제 PR과 병합 상태는 이슈 #54에 연결해 기록한다.
