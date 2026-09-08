import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { createApp } from "@/app";
import { db } from "@/db/client";
import { projects, users, workspaceMemberships } from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";
import { updateProject } from "@/services/project.service";

vi.mock("@/db/client", () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";

const createdProject = {
  id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  workspaceId,
  name: "Brand Campaign",
  description: "브랜드 캠페인 아이디어를 정리하는 프로젝트",
  creatorId: "user-1",
  createdAt: new Date("2026-09-08T00:00:00.000Z"),
  updatedAt: new Date("2026-09-08T00:00:00.000Z"),
};

beforeEach(() => {
  vi.mocked(db.transaction).mockReset();
  vi.mocked(db.select).mockReset();
});

async function createAccessToken(sub = "user-1") {
  return signAccessToken({
    sub,
    email: sub + "@example.com",
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

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectInsert, transaction };
}

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
    select: vi.fn().mockReturnValueOnce(membershipQuery).mockReturnValueOnce(projectQuery),
    update: vi.fn().mockReturnValue(projectUpdate),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectQuery, projectUpdate, transaction };
}

function mockProjectDeleteTransaction({
  membershipRows = [{ role: "owner" }],
  projectRows = [{ id: createdProject.id, creatorId: "user-2" }],
  deletedProjectRows = [{ id: createdProject.id }],
  membershipError,
  projectError,
  deleteError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  deletedProjectRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  deleteError?: Error;
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
  const projectDelete = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: deleteError
      ? vi.fn().mockRejectedValue(deleteError)
      : vi.fn().mockResolvedValue(deletedProjectRows),
  };
  const transaction = {
    select: vi.fn().mockReturnValueOnce(membershipQuery).mockReturnValueOnce(projectQuery),
    update: vi.fn().mockReturnValue(projectDelete),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectQuery, projectDelete, transaction };
}

function mockProjectListQueries({
  membershipRows = [{ id: "membership-1" }],
  countRows = [{ total: 3 }],
  projectRows = [
    {
      ...createdProject,
      creator: { id: "user-1", name: "작성자" },
    },
  ],
  membershipError,
  countError,
  projectError,
}: {
  membershipRows?: unknown[];
  countRows?: unknown[];
  projectRows?: unknown[];
  membershipError?: Error;
  countError?: Error;
  projectError?: Error;
} = {}) {
  const membershipQuery = {
    from: vi.fn().mockReturnThis(),
    where: membershipError
      ? vi.fn().mockRejectedValue(membershipError)
      : vi.fn().mockResolvedValue(membershipRows),
  };
  const countQuery = {
    from: vi.fn().mockReturnThis(),
    where: countError
      ? vi.fn().mockRejectedValue(countError)
      : vi.fn().mockResolvedValue(countRows),
  };
  const projectQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: projectError
      ? vi.fn().mockRejectedValue(projectError)
      : vi.fn().mockResolvedValue(projectRows),
  };

  vi.mocked(db.select)
    .mockReturnValueOnce(membershipQuery as never)
    .mockReturnValueOnce(countQuery as never)
    .mockReturnValueOnce(projectQuery as never);

  return { membershipQuery, countQuery, projectQuery };
}

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

  it("accepts names and descriptions at their trimmed length limits", async () => {
    const { projectInsert } = mockProjectCreateTransaction();
    const name = `  ${"a".repeat(50)}  `;
    const description = `  ${"b".repeat(200)}  `;

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name, description });

    expect(response.status).toBe(201);
    expect(projectInsert.values).toHaveBeenCalledWith({
      workspaceId,
      name: name.trim(),
      description: description.trim(),
      creatorId: "user-1",
    });
  });

  it("allows duplicate project names in the same workspace", async () => {
    const { projectInsert } = mockProjectCreateTransaction();
    const projectRequest = async () =>
      request(createApp())
        .post(`/workspaces/${workspaceId}/projects`)
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send({ name: "Brand Campaign" });

    const firstResponse = await projectRequest();
    const secondResponse = await projectRequest();

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(projectInsert.values).toHaveBeenCalledTimes(2);
    expect(projectInsert.values).toHaveBeenNthCalledWith(1, {
      workspaceId,
      name: "Brand Campaign",
      description: null,
      creatorId: "user-1",
    });
    expect(projectInsert.values).toHaveBeenNthCalledWith(2, {
      workspaceId,
      name: "Brand Campaign",
      description: null,
      creatorId: "user-1",
    });
  });

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
    {
      label: "name is longer than 50 characters",
      pathWorkspaceId: workspaceId,
      body: { name: "a".repeat(51) },
    },
    {
      label: "description is longer than 200 characters",
      pathWorkspaceId: workspaceId,
      body: { name: "Brand Campaign", description: "a".repeat(201) },
    },
    {
      label: "workspace id is not a UUID",
      pathWorkspaceId: "not-a-uuid",
      body: { name: "Brand Campaign" },
    },
    {
      label: "workspace id has invalid UUID version and variant bits",
      pathWorkspaceId: "550e8400-e29b-01d4-0716-446655440000",
      body: { name: "Brand Campaign" },
    },
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

describe("GET /workspaces/:workspaceId/projects", () => {
  it("검색된 프로젝트와 페이지네이션 메타데이터를 반환한다", async () => {
    const createdAt = new Date("2026-09-08T00:00:00.000Z");
    const updatedAt = new Date("2026-09-08T00:05:00.000Z");
    const { membershipQuery, countQuery, projectQuery } = mockProjectListQueries({
      countRows: [{ total: 5 }],
      projectRows: [
        {
          id: "project-3",
          workspaceId,
          name: "Brand Campaign",
          description: "설명",
          creatorId: "user-2",
          creator: { id: "user-2", name: "홍길동" },
          createdAt,
          updatedAt,
        },
      ],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects`)
      .query({ search: "  Brand  ", page: "2", limit: "2" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projects: [
        {
          id: "project-3",
          workspaceId,
          name: "Brand Campaign",
          description: "설명",
          creatorId: "user-2",
          creator: { id: "user-2", name: "홍길동" },
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
    expect(db.select).toHaveBeenNthCalledWith(1, {
      id: workspaceMemberships.id,
    });
    expect(db.select).toHaveBeenNthCalledWith(2, { total: count() });
    expect(db.select).toHaveBeenNthCalledWith(3, {
      id: projects.id,
      workspaceId: projects.workspaceId,
      name: projects.name,
      description: projects.description,
      creatorId: projects.creatorId,
      creator: { id: users.id, name: users.name },
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(countQuery.from).toHaveBeenCalledWith(projects);
    expect(projectQuery.from).toHaveBeenCalledWith(projects);
    expect(countQuery.where).toHaveBeenCalledOnce();
    expect(projectQuery.innerJoin).toHaveBeenCalledWith(users, eq(projects.creatorId, users.id));
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );
    expect(countQuery.where).toHaveBeenCalledWith(
      and(eq(projects.workspaceId, workspaceId), ilike(projects.name, "%Brand%")),
    );
    expect(projectQuery.where).toHaveBeenCalledWith(
      and(eq(projects.workspaceId, workspaceId), ilike(projects.name, "%Brand%")),
    );
    expect(projectQuery.orderBy).toHaveBeenCalledWith(
      desc(projects.updatedAt),
      desc(projects.createdAt),
      asc(projects.id),
    );
    expect(projectQuery.limit).toHaveBeenCalledWith(2);
    expect(projectQuery.offset).toHaveBeenCalledWith(2);
  });

  it("검색어의 LIKE 와일드카드와 백슬래시를 escape한 패턴을 count와 목록 조회에 전달한다", async () => {
    const { countQuery, projectQuery } = mockProjectListQueries({
      countRows: [{ total: 0 }],
      projectRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects`)
      .query({ search: "100%_done\\now" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(countQuery.where).toHaveBeenCalledWith(
      and(eq(projects.workspaceId, workspaceId), ilike(projects.name, "%100\\%\\_done\\\\now%")),
    );
    expect(projectQuery.where).toHaveBeenCalledWith(
      and(eq(projects.workspaceId, workspaceId), ilike(projects.name, "%100\\%\\_done\\\\now%")),
    );
  });

  it("query가 없으면 1페이지와 20개 기본값을 사용한다", async () => {
    const { countQuery, projectQuery } = mockProjectListQueries({
      countRows: [{ total: 0 }],
      projectRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projects: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(countQuery.where).toHaveBeenCalledOnce();
    expect(projectQuery.limit).toHaveBeenCalledWith(20);
    expect(projectQuery.offset).toHaveBeenCalledWith(0);
  });

  it("검색 결과가 없으면 빈 목록을 반환한다", async () => {
    mockProjectListQueries({ countRows: [{ total: 0 }], projectRows: [] });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects`)
      .query({ search: "missing" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.projects).toEqual([]);
    expect(response.body.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("인증이 없으면 401을 반환하고 DB를 조회하지 않는다", async () => {
    const response = await request(createApp()).get(`/workspaces/${workspaceId}/projects`);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.select).not.toHaveBeenCalled();
  });

  it.each([
    { workspaceId: "not-a-uuid", query: {} },
    { workspaceId, query: { page: "0" } },
    { workspaceId, query: { limit: "101" } },
    { workspaceId, query: { search: "a".repeat(101) } },
  ])(
    "목록 입력이 잘못되면 400을 반환한다: $query",
    async ({ workspaceId: pathWorkspaceId, query }) => {
      const response = await request(createApp())
        .get(`/workspaces/${pathWorkspaceId}/projects`)
        .query(query)
        .set("Authorization", `Bearer ${await createAccessToken()}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(db.select).not.toHaveBeenCalled();
    },
  );

  it("비멤버면 404를 반환하고 프로젝트 조회를 실행하지 않는다", async () => {
    const { countQuery, projectQuery } = mockProjectListQueries({
      membershipRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(countQuery.where).not.toHaveBeenCalled();
    expect(projectQuery.where).not.toHaveBeenCalled();
  });

  it("전체 페이지를 초과하면 빈 목록과 계산된 페이지 정보를 반환한다", async () => {
    const { projectQuery } = mockProjectListQueries({
      countRows: [{ total: 5 }],
      projectRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects`)
      .query({ page: "4", limit: "2" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projects: [],
      pagination: { page: 4, limit: 2, total: 5, totalPages: 3 },
    });
    expect(projectQuery.limit).toHaveBeenCalledWith(2);
    expect(projectQuery.offset).toHaveBeenCalledWith(6);
  });

  it.each([
    {
      label: "멤버십",
      options: { membershipError: new Error("membership failed") },
    },
    { label: "개수", options: { countError: new Error("count failed") } },
    {
      label: "프로젝트 목록",
      options: { projectError: new Error("projects failed") },
    },
  ])("$label 조회가 실패하면 500을 반환한다", async ({ label, options }) => {
    const { membershipQuery, countQuery, projectQuery } = mockProjectListQueries(options);

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");

    if (label === "멤버십") {
      expect(db.select).toHaveBeenCalledOnce();
      expect(membershipQuery.where).toHaveBeenCalledOnce();
      expect(countQuery.where).not.toHaveBeenCalled();
      expect(projectQuery.where).not.toHaveBeenCalled();
      return;
    }

    expect(membershipQuery.where).toHaveBeenCalledOnce();
    expect(countQuery.where).toHaveBeenCalledOnce();
    expect(projectQuery.where).toHaveBeenCalledOnce();

    if (label === "프로젝트 목록") {
      expect(projectQuery.orderBy).toHaveBeenCalledOnce();
      expect(projectQuery.limit).toHaveBeenCalledOnce();
      expect(projectQuery.offset).toHaveBeenCalledOnce();
    }
  });
});

describe("PATCH /workspaces/:workspaceId/projects/:projectId", () => {
  it("allows an owner to update any project name and description", async () => {
    const { projectUpdate } = mockProjectUpdateTransaction();

    const response = await request(createApp())
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
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
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
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
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "  Updated Campaign  " });

    expect(response.status).toBe(200);
    expect(projectUpdate.set).toHaveBeenCalledWith({
      name: "Updated Campaign",
      updatedAt: expect.any(Date),
    });
  });

  it.each([null, "   "])("normalizes description %j to null", async (description) => {
    const { projectUpdate } = mockProjectUpdateTransaction();

    const response = await request(createApp())
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ description });

    expect(response.status).toBe(200);
    expect(projectUpdate.set).toHaveBeenCalledWith({
      description: null,
      updatedAt: expect.any(Date),
    });
  });

  it("returns 400 for an empty PATCH body", async () => {
    const response = await request(createApp())
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
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
    { label: "invalid workspace id", path: `not-a-uuid/projects/${createdProject.id}` },
    { label: "invalid project id", path: `${workspaceId}/projects/not-a-uuid` },
    {
      label: "invalid name",
      path: `${workspaceId}/projects/${createdProject.id}`,
      body: { name: "   " },
    },
    {
      label: "null name",
      path: `${workspaceId}/projects/${createdProject.id}`,
      body: { name: null },
    },
    {
      label: "invalid description type",
      path: `${workspaceId}/projects/${createdProject.id}`,
      body: { description: 123 },
    },
    {
      label: "description longer than 200 characters",
      path: `${workspaceId}/projects/${createdProject.id}`,
      body: { description: "a".repeat(201) },
    },
  ])("returns 400 for $label", async ({ path, body }) => {
    const response = await request(createApp())
      .patch(`/workspaces/${path}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 401 without authentication", async () => {
    const response = await request(createApp()).patch(
      `/workspaces/${workspaceId}/projects/${createdProject.id}`,
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
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Updated Campaign" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(projectQuery.where).not.toHaveBeenCalled();
    expect(projectUpdate.set).not.toHaveBeenCalled();
  });

  it("returns 404 when the project is not in the requested workspace", async () => {
    const { projectUpdate } = mockProjectUpdateTransaction({ projectRows: [] });

    const response = await request(createApp())
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
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
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Updated Campaign" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PROJECT_UPDATE_FORBIDDEN");
    expect(projectUpdate.set).not.toHaveBeenCalled();
  });

  it("returns 500 and stops after a membership query error", async () => {
    const { projectQuery, projectUpdate } = mockProjectUpdateTransaction({
      membershipError: new Error("membership query failed"),
    });

    const response = await request(createApp())
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
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
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
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
      .patch(`/workspaces/${workspaceId}/projects/${createdProject.id}`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Updated Campaign" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(projectUpdate.set).toHaveBeenCalledWith({
      name: "Updated Campaign",
      updatedAt: expect.any(Date),
    });
  });
});

describe("DELETE /workspaces/:workspaceId/projects/:projectId", () => {
  it("allows an owner to delete another creator's project and returns 204", async () => {
    const { projectQuery, projectDelete } = mockProjectDeleteTransaction();

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(projectQuery.where).toHaveBeenCalledWith(
      and(
        eq(projects.id, createdProject.id),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
      ),
    );
    expect(projectDelete.set).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(projectDelete.where).toHaveBeenCalledWith(
      and(
        eq(projects.id, createdProject.id),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
      ),
    );
  });

  it("allows the project creator member to delete the project", async () => {
    const { projectDelete } = mockProjectDeleteTransaction({
      membershipRows: [{ role: "member" }],
      projectRows: [{ id: createdProject.id, creatorId: "user-1" }],
    });

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(204);
    expect(projectDelete.set).toHaveBeenCalledOnce();
  });

  it("returns 404 for a non-member before looking up the project", async () => {
    const { projectQuery, projectDelete } = mockProjectDeleteTransaction({ membershipRows: [] });

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(projectQuery.where).not.toHaveBeenCalled();
    expect(projectDelete.set).not.toHaveBeenCalled();
  });

  it("returns 403 for a member who did not create the project", async () => {
    const { projectDelete } = mockProjectDeleteTransaction({
      membershipRows: [{ role: "member" }],
    });

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("PROJECT_DELETE_FORBIDDEN");
    expect(projectDelete.set).not.toHaveBeenCalled();
  });

  it.each([
    { label: "workspace id", path: "not-a-uuid/projects/" + createdProject.id },
    { label: "project id", path: workspaceId + "/projects/not-a-uuid" },
  ])("returns 400 for an invalid $label", async ({ path }) => {
    const response = await request(createApp())
      .delete("/workspaces/" + path)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the active project is missing or already deleted", async () => {
    const { projectDelete } = mockProjectDeleteTransaction({ projectRows: [] });

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(projectDelete.set).not.toHaveBeenCalled();
  });

  it("returns 401 without authentication", async () => {
    const response = await request(createApp()).delete(
      "/workspaces/" + workspaceId + "/projects/" + createdProject.id,
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { label: "membership", options: { membershipError: new Error("membership failed") } },
    { label: "project", options: { projectError: new Error("project failed") } },
    { label: "delete", options: { deleteError: new Error("delete failed") } },
  ])("returns 500 when the $label query fails", async ({ options }) => {
    const { projectQuery, projectDelete } = mockProjectDeleteTransaction(options);

    const response = await request(createApp())
      .delete("/workspaces/" + workspaceId + "/projects/" + createdProject.id)
      .set("Authorization", "Bearer " + (await createAccessToken()));

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");

    if (options.membershipError) {
      expect(projectQuery.where).not.toHaveBeenCalled();
      expect(projectDelete.set).not.toHaveBeenCalled();
    }
    if (options.projectError) {
      expect(projectDelete.set).not.toHaveBeenCalled();
    }
  });
});
