import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Express } from "express";
import postgres, { type Sql } from "postgres";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";

const integration = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;

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
      migrationsFolder: fileURLToPath(new URL("../src/db/migrations", import.meta.url)),
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
  ] as const)("%s가 문서 없는 프로젝트의 공개 정보만 조회한다", async (_role, userId) => {
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
  });

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
      const response = await getProject(activeProjectId, userId, targetWorkspaceId);
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
      expect(response.body.project.creator).toEqual({ id: creatorId, name: "변경된 작성자" });
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
