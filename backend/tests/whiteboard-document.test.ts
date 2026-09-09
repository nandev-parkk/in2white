import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { createApp } from "@/app";
import { db } from "@/db/client";
import { projects, users, whiteboardDocuments, workspaceMemberships } from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";

vi.mock("@/db/client", () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

const createdWhiteboardDocument = {
  id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  projectId,
  name: "아이디어 스케치",
  creatorId: "user-1",
  canvasContent: {},
  createdAt: new Date("2026-09-09T00:00:00.000Z"),
  updatedAt: new Date("2026-09-09T00:00:00.000Z"),
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

function mockWhiteboardDocumentCreateTransaction({
  membershipRows = [{ id: "membership-1" }],
  projectRows = [{ id: projectId }],
  documentRows = [createdWhiteboardDocument],
  membershipError,
  projectError,
  insertError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  documentRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  insertError?: Error;
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
  const documentInsert = {
    values: vi.fn().mockReturnThis(),
    returning: insertError
      ? vi.fn().mockRejectedValue(insertError)
      : vi.fn().mockResolvedValue(documentRows),
  };
  const transaction = {
    select: vi.fn().mockReturnValueOnce(membershipQuery).mockReturnValueOnce(projectQuery),
    insert: vi.fn().mockReturnValue(documentInsert),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectQuery, documentInsert, transaction };
}

function mockWhiteboardDocumentListQueries({
  membershipRows = [{ id: "membership-1" }],
  projectRows = [{ id: projectId }],
  countRows = [{ total: 1 }],
  documentRows = [
    {
      id: createdWhiteboardDocument.id,
      projectId,
      name: createdWhiteboardDocument.name,
      creatorId: createdWhiteboardDocument.creatorId,
      creator: { id: createdWhiteboardDocument.creatorId, name: "작성자" },
      createdAt: createdWhiteboardDocument.createdAt,
      updatedAt: createdWhiteboardDocument.updatedAt,
      canvasContent: { elements: [{ type: "rectangle" }] },
    },
  ],
  membershipError,
  projectError,
  countError,
  documentError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  countRows?: unknown[];
  documentRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  countError?: Error;
  documentError?: Error;
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
  const countQuery = {
    from: vi.fn().mockReturnThis(),
    where: countError
      ? vi.fn().mockRejectedValue(countError)
      : vi.fn().mockResolvedValue(countRows),
  };
  const documentQuery = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: documentError
      ? vi.fn().mockRejectedValue(documentError)
      : vi.fn().mockResolvedValue(documentRows),
  };

  vi.mocked(db.select)
    .mockReturnValueOnce(membershipQuery as never)
    .mockReturnValueOnce(projectQuery as never)
    .mockReturnValueOnce(countQuery as never)
    .mockReturnValueOnce(documentQuery as never);

  return { membershipQuery, projectQuery, countQuery, documentQuery };
}

describe("POST /workspaces/:workspaceId/projects/:projectId/whiteboard-documents", () => {
  it("creates a whiteboard document for a workspace member and returns 201", async () => {
    const { membershipQuery, projectQuery, documentInsert, transaction } =
      mockWhiteboardDocumentCreateTransaction();

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "  아이디어 스케치  " });

    expect(response.status).toBe(201);
    expect(response.body.whiteboardDocument).toEqual({
      ...createdWhiteboardDocument,
      createdAt: createdWhiteboardDocument.createdAt.toISOString(),
      updatedAt: createdWhiteboardDocument.updatedAt.toISOString(),
    });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transaction.select).toHaveBeenNthCalledWith(1, { id: workspaceMemberships.id });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );
    expect(transaction.select).toHaveBeenNthCalledWith(2, { id: projects.id });
    expect(projectQuery.from).toHaveBeenCalledWith(projects);
    expect(projectQuery.where).toHaveBeenCalledWith(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
      ),
    );
    expect(transaction.insert).toHaveBeenCalledWith(whiteboardDocuments);
    expect(documentInsert.values).toHaveBeenCalledWith({
      projectId,
      name: "아이디어 스케치",
      creatorId: "user-1",
    });
  });

  it.each(["owner", "member"] as const)(
    "allows a workspace %s to create a whiteboard document",
    async (role) => {
      mockWhiteboardDocumentCreateTransaction({
        membershipRows: [{ id: `membership-${role}`, role }],
      });

      const response = await request(createApp())
        .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send({ name: "아이디어 스케치" });

      expect(response.status).toBe(201);
    },
  );

  it("accepts a name at the trimmed length limit", async () => {
    const { documentInsert } = mockWhiteboardDocumentCreateTransaction();
    const name = `  ${"a".repeat(50)}  `;

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name });

    expect(response.status).toBe(201);
    expect(documentInsert.values).toHaveBeenCalledWith({
      projectId,
      name: name.trim(),
      creatorId: "user-1",
    });
  });

  it("returns 401 when the request is not authenticated", async () => {
    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .send({ name: "아이디어 스케치" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    { label: "name is missing", pathWorkspaceId: workspaceId, pathProjectId: projectId, body: {} },
    {
      label: "name is blank",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      body: { name: "   " },
    },
    {
      label: "name is not a string",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      body: { name: 123 },
    },
    {
      label: "name is longer than 50 characters",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      body: { name: "a".repeat(51) },
    },
    {
      label: "workspace id is not a UUID",
      pathWorkspaceId: "not-a-uuid",
      pathProjectId: projectId,
      body: { name: "아이디어 스케치" },
    },
    {
      label: "project id is not a UUID",
      pathWorkspaceId: workspaceId,
      pathProjectId: "not-a-uuid",
      body: { name: "아이디어 스케치" },
    },
    {
      label: "workspace id has invalid UUID version and variant bits",
      pathWorkspaceId: "550e8400-e29b-01d4-0716-446655440000",
      pathProjectId: projectId,
      body: { name: "아이디어 스케치" },
    },
    {
      label: "project id has invalid UUID version and variant bits",
      pathWorkspaceId: workspaceId,
      pathProjectId: "7c9e6679-7425-01de-044b-e07fc1f90ae7",
      body: { name: "아이디어 스케치" },
    },
  ])("returns 400 when $label", async ({ pathWorkspaceId, pathProjectId, body }) => {
    const response = await request(createApp())
      .post(`/workspaces/${pathWorkspaceId}/projects/${pathProjectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 and does not query the project or insert when the user is not a workspace member", async () => {
    const { projectQuery, documentInsert } = mockWhiteboardDocumentCreateTransaction({
      membershipRows: [],
    });

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "아이디어 스케치" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(projectQuery.from).not.toHaveBeenCalled();
    expect(documentInsert.values).not.toHaveBeenCalled();
  });

  it.each([
    { label: "the project does not exist", projectRows: [] },
    { label: "the project belongs to another workspace", projectRows: [] },
    { label: "the project was deleted", projectRows: [] },
  ])("returns 404 and does not insert when $label", async ({ projectRows }) => {
    const { documentInsert } = mockWhiteboardDocumentCreateTransaction({ projectRows });

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "아이디어 스케치" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(documentInsert.values).not.toHaveBeenCalled();
  });

  it("returns 500 when the membership query fails", async () => {
    mockWhiteboardDocumentCreateTransaction({
      membershipError: new Error("membership query failed"),
    });

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "아이디어 스케치" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("returns 500 when the project query fails", async () => {
    mockWhiteboardDocumentCreateTransaction({ projectError: new Error("project query failed") });

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "아이디어 스케치" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("returns 500 when the whiteboard document insert fails", async () => {
    mockWhiteboardDocumentCreateTransaction({ insertError: new Error("document insert failed") });

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "아이디어 스케치" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("returns 500 when the whiteboard document insert returns no row", async () => {
    mockWhiteboardDocumentCreateTransaction({ documentRows: [] });

    const response = await request(createApp())
      .post(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "아이디어 스케치" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("GET /workspaces/:workspaceId/projects/:projectId/whiteboard-documents", () => {
  it("검색된 화이트보드 문서와 페이지네이션 메타데이터를 반환한다", async () => {
    const createdAt = new Date("2026-09-09T00:00:00.000Z");
    const updatedAt = new Date("2026-09-09T00:05:00.000Z");
    const { membershipQuery, projectQuery, countQuery, documentQuery } =
      mockWhiteboardDocumentListQueries({
        countRows: [{ total: 5 }],
        documentRows: [
          {
            id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
            projectId,
            name: "Brand Campaign",
            creatorId: "user-2",
            creator: { id: "user-2", name: "홍길동" },
            createdAt,
            updatedAt,
          },
        ],
      });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .query({ search: "  Brand  ", page: "2", limit: "2" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      whiteboardDocuments: [
        {
          id: "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
          projectId,
          name: "Brand Campaign",
          creatorId: "user-2",
          creator: { id: "user-2", name: "홍길동" },
          createdAt: createdAt.toISOString(),
          updatedAt: updatedAt.toISOString(),
        },
      ],
      pagination: { page: 2, limit: 2, total: 5, totalPages: 3 },
    });
    expect(db.select).toHaveBeenNthCalledWith(1, { id: workspaceMemberships.id });
    expect(db.select).toHaveBeenNthCalledWith(2, { id: projects.id });
    expect(db.select).toHaveBeenNthCalledWith(3, { total: count() });
    expect(db.select).toHaveBeenNthCalledWith(4, {
      id: whiteboardDocuments.id,
      projectId: whiteboardDocuments.projectId,
      name: whiteboardDocuments.name,
      creatorId: whiteboardDocuments.creatorId,
      creator: { id: users.id, name: users.name },
      createdAt: whiteboardDocuments.createdAt,
      updatedAt: whiteboardDocuments.updatedAt,
    });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(projectQuery.from).toHaveBeenCalledWith(projects);
    expect(countQuery.from).toHaveBeenCalledWith(whiteboardDocuments);
    expect(documentQuery.from).toHaveBeenCalledWith(whiteboardDocuments);
    expect(documentQuery.innerJoin).toHaveBeenCalledWith(
      users,
      eq(whiteboardDocuments.creatorId, users.id),
    );
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );
    expect(projectQuery.where).toHaveBeenCalledWith(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
      ),
    );
    expect(countQuery.where).toHaveBeenCalledWith(
      and(eq(whiteboardDocuments.projectId, projectId), ilike(whiteboardDocuments.name, "%Brand%")),
    );
    expect(documentQuery.where).toHaveBeenCalledWith(
      and(eq(whiteboardDocuments.projectId, projectId), ilike(whiteboardDocuments.name, "%Brand%")),
    );
    expect(documentQuery.orderBy).toHaveBeenCalledWith(
      desc(whiteboardDocuments.updatedAt),
      desc(whiteboardDocuments.createdAt),
      asc(whiteboardDocuments.id),
    );
    expect(documentQuery.limit).toHaveBeenCalledWith(2);
    expect(documentQuery.offset).toHaveBeenCalledWith(2);
  });

  it.each(["owner", "member"] as const)(
    "워크스페이스 %s가 문서 목록을 조회할 수 있다",
    async (role) => {
      mockWhiteboardDocumentListQueries({ membershipRows: [{ id: `membership-${role}`, role }] });

      const response = await request(createApp())
        .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
        .set("Authorization", `Bearer ${await createAccessToken()}`);

      expect(response.status).toBe(200);
    },
  );

  it("query가 없으면 1페이지와 20개 기본값을 사용하고 canvasContent를 반환하지 않는다", async () => {
    const { countQuery, documentQuery } = mockWhiteboardDocumentListQueries({
      countRows: [{ total: 0 }],
      documentRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      whiteboardDocuments: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(countQuery.where).toHaveBeenCalledWith(
      and(eq(whiteboardDocuments.projectId, projectId)),
    );
    expect(documentQuery.where).toHaveBeenCalledWith(
      and(eq(whiteboardDocuments.projectId, projectId)),
    );
    expect(documentQuery.limit).toHaveBeenCalledWith(20);
    expect(documentQuery.offset).toHaveBeenCalledWith(0);
    expect(documentQuery.where.mock.calls[0]?.[0]).not.toHaveProperty("canvasContent");
  });

  it("검색어의 LIKE 와일드카드와 백슬래시를 escape한 패턴을 전달한다", async () => {
    const { countQuery, documentQuery } = mockWhiteboardDocumentListQueries({
      countRows: [{ total: 0 }],
      documentRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .query({ search: "100%_done\\now" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(countQuery.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocuments.projectId, projectId),
        ilike(whiteboardDocuments.name, "%100\\%\\_done\\\\now%"),
      ),
    );
    expect(documentQuery.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocuments.projectId, projectId),
        ilike(whiteboardDocuments.name, "%100\\%\\_done\\\\now%"),
      ),
    );
  });

  it("검색 결과가 없거나 전체 페이지를 초과하면 빈 목록을 반환한다", async () => {
    const { documentQuery } = mockWhiteboardDocumentListQueries({
      countRows: [{ total: 5 }],
      documentRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .query({ page: "4", limit: "2" })
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      whiteboardDocuments: [],
      pagination: { page: 4, limit: 2, total: 5, totalPages: 3 },
    });
    expect(documentQuery.limit).toHaveBeenCalledWith(2);
    expect(documentQuery.offset).toHaveBeenCalledWith(6);
  });

  it("인증이 없으면 401을 반환하고 DB를 조회하지 않는다", async () => {
    const response = await request(createApp()).get(
      `/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`,
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.select).not.toHaveBeenCalled();
  });

  it.each([
    { pathWorkspaceId: "not-a-uuid", pathProjectId: projectId, query: {} },
    { pathWorkspaceId: workspaceId, pathProjectId: "not-a-uuid", query: {} },
    { pathWorkspaceId: workspaceId, pathProjectId: projectId, query: { page: "0" } },
    { pathWorkspaceId: workspaceId, pathProjectId: projectId, query: { limit: "101" } },
    {
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      query: { search: "a".repeat(101) },
    },
  ])(
    "목록 입력이 잘못되면 400을 반환한다: $query",
    async ({ pathWorkspaceId, pathProjectId, query }) => {
      const response = await request(createApp())
        .get(`/workspaces/${pathWorkspaceId}/projects/${pathProjectId}/whiteboard-documents`)
        .query(query)
        .set("Authorization", `Bearer ${await createAccessToken()}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(db.select).not.toHaveBeenCalled();
    },
  );

  it("비멤버면 404 WORKSPACE_NOT_FOUND를 반환하고 project/list query를 실행하지 않는다", async () => {
    const { projectQuery, countQuery, documentQuery } = mockWhiteboardDocumentListQueries({
      membershipRows: [],
    });

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(projectQuery.where).not.toHaveBeenCalled();
    expect(countQuery.where).not.toHaveBeenCalled();
    expect(documentQuery.where).not.toHaveBeenCalled();
  });

  it.each([
    { label: "프로젝트가 없다", projectRows: [] },
    { label: "다른 워크스페이스에 속한다", projectRows: [] },
    { label: "삭제되었다", projectRows: [] },
  ])(
    "$label면 404 PROJECT_NOT_FOUND를 반환하고 문서 query를 실행하지 않는다",
    async ({ projectRows }) => {
      const { countQuery, documentQuery } = mockWhiteboardDocumentListQueries({ projectRows });

      const response = await request(createApp())
        .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
        .set("Authorization", `Bearer ${await createAccessToken()}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
      expect(countQuery.where).not.toHaveBeenCalled();
      expect(documentQuery.where).not.toHaveBeenCalled();
    },
  );

  it.each([
    { label: "멤버십", options: { membershipError: new Error("membership failed") } },
    { label: "프로젝트", options: { projectError: new Error("project failed") } },
    { label: "개수", options: { countError: new Error("count failed") } },
    { label: "문서 목록", options: { documentError: new Error("documents failed") } },
  ])("$label query가 실패하면 500을 반환한다", async ({ label, options }) => {
    const { membershipQuery, projectQuery, countQuery, documentQuery } =
      mockWhiteboardDocumentListQueries(options);

    const response = await request(createApp())
      .get(`/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");

    if (label === "멤버십") {
      expect(db.select).toHaveBeenCalledOnce();
      expect(membershipQuery.where).toHaveBeenCalledOnce();
      expect(projectQuery.where).not.toHaveBeenCalled();
      expect(countQuery.where).not.toHaveBeenCalled();
      expect(documentQuery.where).not.toHaveBeenCalled();
      return;
    }

    if (label === "프로젝트") {
      expect(projectQuery.where).toHaveBeenCalledOnce();
      expect(countQuery.where).not.toHaveBeenCalled();
      expect(documentQuery.where).not.toHaveBeenCalled();
      return;
    }

    expect(countQuery.where).toHaveBeenCalledOnce();
    expect(documentQuery.where).toHaveBeenCalledOnce();
  });
});
