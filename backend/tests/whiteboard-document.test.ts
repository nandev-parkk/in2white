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

const createdWhiteboardDocumentRow = {
  ...createdWhiteboardDocument,
  deletedAt: null,
};

const updatedWhiteboardDocument = {
  id: createdWhiteboardDocument.id,
  name: "변경된 문서 이름",
  updatedAt: new Date("2026-09-09T00:05:00.000Z"),
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
  documentRows = [createdWhiteboardDocumentRow],
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
      : vi
          .fn()
          .mockImplementation((projection?: Record<string, unknown>) =>
            Promise.resolve(
              projection
                ? documentRows.map((row) =>
                    Object.fromEntries(
                      Object.keys(projection).map((key) => [
                        key,
                        (row as Record<string, unknown>)[key],
                      ]),
                    ),
                  )
                : documentRows,
            ),
          ),
  };
  const transaction = {
    select: vi.fn().mockReturnValueOnce(membershipQuery).mockReturnValueOnce(projectQuery),
    insert: vi.fn().mockReturnValue(documentInsert),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectQuery, documentInsert, transaction };
}

function mockWhiteboardDocumentUpdateTransaction({
  membershipRows = [{ role: "owner" }],
  projectRows = [{ id: projectId }],
  documentRows = [{ id: createdWhiteboardDocument.id, creatorId: "user-2" }],
  updatedDocumentRows = [updatedWhiteboardDocument],
  membershipError,
  projectError,
  documentError,
  updateError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  documentRows?: unknown[];
  updatedDocumentRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  documentError?: Error;
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
  const documentQuery = {
    from: vi.fn().mockReturnThis(),
    where: documentError
      ? vi.fn().mockRejectedValue(documentError)
      : vi.fn().mockResolvedValue(documentRows),
  };
  const documentUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: updateError
      ? vi.fn().mockRejectedValue(updateError)
      : vi.fn().mockResolvedValue(updatedDocumentRows),
  };
  const transaction = {
    select: vi
      .fn()
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(projectQuery)
      .mockReturnValueOnce(documentQuery),
    update: vi.fn().mockReturnValue(documentUpdate),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectQuery, documentQuery, documentUpdate, transaction };
}

function mockWhiteboardDocumentDeleteTransaction({
  membershipRows = [{ role: "owner" }],
  projectRows = [{ id: projectId }],
  documentRows = [{ id: createdWhiteboardDocument.id, creatorId: "user-2" }],
  deletedDocumentRows = [{ id: createdWhiteboardDocument.id }],
  membershipError,
  projectError,
  documentError,
  deleteError,
}: {
  membershipRows?: unknown[];
  projectRows?: unknown[];
  documentRows?: unknown[];
  deletedDocumentRows?: unknown[];
  membershipError?: Error;
  projectError?: Error;
  documentError?: Error;
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
  const documentQuery = {
    from: vi.fn().mockReturnThis(),
    where: documentError
      ? vi.fn().mockRejectedValue(documentError)
      : vi.fn().mockResolvedValue(documentRows),
  };
  const documentUpdate = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: deleteError
      ? vi.fn().mockRejectedValue(deleteError)
      : vi.fn().mockResolvedValue(deletedDocumentRows),
  };
  const transaction = {
    select: vi
      .fn()
      .mockReturnValueOnce(membershipQuery)
      .mockReturnValueOnce(projectQuery)
      .mockReturnValueOnce(documentQuery),
    update: vi.fn().mockReturnValue(documentUpdate),
  };

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectQuery, documentQuery, documentUpdate, transaction };
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
    expect(response.body.whiteboardDocument).not.toHaveProperty("deletedAt");
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
    expect(documentInsert.returning).toHaveBeenCalledWith({
      id: whiteboardDocuments.id,
      projectId: whiteboardDocuments.projectId,
      name: whiteboardDocuments.name,
      creatorId: whiteboardDocuments.creatorId,
      canvasContent: whiteboardDocuments.canvasContent,
      createdAt: whiteboardDocuments.createdAt,
      updatedAt: whiteboardDocuments.updatedAt,
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
      and(
        eq(whiteboardDocuments.projectId, projectId),
        isNull(whiteboardDocuments.deletedAt),
        ilike(whiteboardDocuments.name, "%Brand%"),
      ),
    );
    expect(documentQuery.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocuments.projectId, projectId),
        isNull(whiteboardDocuments.deletedAt),
        ilike(whiteboardDocuments.name, "%Brand%"),
      ),
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
      and(eq(whiteboardDocuments.projectId, projectId), isNull(whiteboardDocuments.deletedAt)),
    );
    expect(documentQuery.where).toHaveBeenCalledWith(
      and(eq(whiteboardDocuments.projectId, projectId), isNull(whiteboardDocuments.deletedAt)),
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
        isNull(whiteboardDocuments.deletedAt),
        ilike(whiteboardDocuments.name, "%100\\%\\_done\\\\now%"),
      ),
    );
    expect(documentQuery.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocuments.projectId, projectId),
        isNull(whiteboardDocuments.deletedAt),
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

describe("PATCH /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId", () => {
  const patchPath = `/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents/${createdWhiteboardDocument.id}`;

  it("Owner가 다른 Creator의 문서 이름을 변경하고 최소 응답을 반환한다", async () => {
    const { membershipQuery, projectQuery, documentQuery, documentUpdate, transaction } =
      mockWhiteboardDocumentUpdateTransaction();

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "  변경된 문서 이름  " });

    expect(response.status).toBe(200);
    expect(response.body.whiteboardDocument).toEqual({
      id: updatedWhiteboardDocument.id,
      name: updatedWhiteboardDocument.name,
      updatedAt: updatedWhiteboardDocument.updatedAt.toISOString(),
    });
    expect(response.body.whiteboardDocument).not.toHaveProperty("canvasContent");
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transaction.select).toHaveBeenNthCalledWith(1, { role: workspaceMemberships.role });
    expect(transaction.select).toHaveBeenNthCalledWith(2, { id: projects.id });
    expect(transaction.select).toHaveBeenNthCalledWith(3, {
      id: whiteboardDocuments.id,
      creatorId: whiteboardDocuments.creatorId,
    });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );
    expect(projectQuery.from).toHaveBeenCalledWith(projects);
    expect(projectQuery.where).toHaveBeenCalledWith(
      and(
        eq(projects.id, projectId),
        eq(projects.workspaceId, workspaceId),
        isNull(projects.deletedAt),
      ),
    );
    expect(documentQuery.from).toHaveBeenCalledWith(whiteboardDocuments);
    expect(documentQuery.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
        eq(whiteboardDocuments.projectId, projectId),
        isNull(whiteboardDocuments.deletedAt),
      ),
    );
    expect(documentUpdate.set).toHaveBeenCalledWith({
      name: "변경된 문서 이름",
      updatedAt: expect.any(Date),
    });
    expect(documentUpdate.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
        eq(whiteboardDocuments.projectId, projectId),
        isNull(whiteboardDocuments.deletedAt),
      ),
    );
    expect(documentUpdate.returning).toHaveBeenCalledWith({
      id: whiteboardDocuments.id,
      name: whiteboardDocuments.name,
      updatedAt: whiteboardDocuments.updatedAt,
    });
  });

  it("Member가 자신이 생성한 문서 이름을 변경할 수 있다", async () => {
    const { documentUpdate } = mockWhiteboardDocumentUpdateTransaction({
      membershipRows: [{ role: "member" }],
      documentRows: [{ id: createdWhiteboardDocument.id, creatorId: "user-1" }],
    });

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(200);
    expect(documentUpdate.set).toHaveBeenCalledWith({
      name: "변경된 문서 이름",
      updatedAt: expect.any(Date),
    });
  });

  it("이름을 trim하고 50자까지 허용한다", async () => {
    const { documentUpdate } = mockWhiteboardDocumentUpdateTransaction();
    const name = `  ${"a".repeat(50)}  `;

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name });

    expect(response.status).toBe(200);
    expect(documentUpdate.set).toHaveBeenCalledWith({
      name: name.trim(),
      updatedAt: expect.any(Date),
    });
  });

  it("인증이 없으면 401을 반환하고 transaction을 호출하지 않는다", async () => {
    const response = await request(createApp()).patch(patchPath).send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "name이 없다",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      pathDocumentId: createdWhiteboardDocument.id,
      body: {},
    },
    {
      label: "name이 공백이다",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      pathDocumentId: createdWhiteboardDocument.id,
      body: { name: "   " },
    },
    {
      label: "name이 문자열이 아니다",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      pathDocumentId: createdWhiteboardDocument.id,
      body: { name: 123 },
    },
    {
      label: "name이 50자를 초과한다",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      pathDocumentId: createdWhiteboardDocument.id,
      body: { name: "a".repeat(51) },
    },
    {
      label: "workspaceId가 UUID가 아니다",
      pathWorkspaceId: "not-a-uuid",
      pathProjectId: projectId,
      pathDocumentId: createdWhiteboardDocument.id,
      body: { name: "변경된 문서 이름" },
    },
    {
      label: "projectId가 UUID가 아니다",
      pathWorkspaceId: workspaceId,
      pathProjectId: "not-a-uuid",
      pathDocumentId: createdWhiteboardDocument.id,
      body: { name: "변경된 문서 이름" },
    },
    {
      label: "documentId가 UUID가 아니다",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      pathDocumentId: "not-a-uuid",
      body: { name: "변경된 문서 이름" },
    },
  ])(
    "$label이면 400을 반환하고 transaction을 호출하지 않는다",
    async ({ pathWorkspaceId, pathProjectId, pathDocumentId, body }) => {
      const response = await request(createApp())
        .patch(
          `/workspaces/${pathWorkspaceId}/projects/${pathProjectId}/whiteboard-documents/${pathDocumentId}`,
        )
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it("비멤버면 404 WORKSPACE_NOT_FOUND를 반환하고 이후 query를 실행하지 않는다", async () => {
    const { projectQuery, documentQuery, documentUpdate } = mockWhiteboardDocumentUpdateTransaction(
      {
        membershipRows: [],
      },
    );

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(projectQuery.from).not.toHaveBeenCalled();
    expect(documentQuery.from).not.toHaveBeenCalled();
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it.each([
    { label: "프로젝트가 없다", projectRows: [] },
    { label: "다른 워크스페이스에 속한다", projectRows: [] },
    { label: "삭제되었다", projectRows: [] },
  ])(
    "$label면 404 PROJECT_NOT_FOUND를 반환하고 문서 query를 실행하지 않는다",
    async ({ projectRows }) => {
      const { documentQuery, documentUpdate } = mockWhiteboardDocumentUpdateTransaction({
        projectRows,
      });

      const response = await request(createApp())
        .patch(patchPath)
        .set("Authorization", `Bearer ${await createAccessToken()}`)
        .send({ name: "변경된 문서 이름" });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
      expect(documentQuery.from).not.toHaveBeenCalled();
      expect(documentUpdate.set).not.toHaveBeenCalled();
    },
  );

  it("문서가 없거나 다른 project에 속하면 404 WHITEBOARD_DOCUMENT_NOT_FOUND를 반환한다", async () => {
    const { documentQuery, documentUpdate } = mockWhiteboardDocumentUpdateTransaction({
      documentRows: [],
    });

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WHITEBOARD_DOCUMENT_NOT_FOUND");
    expect(documentQuery.where).toHaveBeenCalledOnce();
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it("문서 Creator가 아닌 Member는 403을 반환하고 update하지 않는다", async () => {
    const { documentUpdate } = mockWhiteboardDocumentUpdateTransaction({
      membershipRows: [{ role: "member" }],
      documentRows: [{ id: createdWhiteboardDocument.id, creatorId: "user-2" }],
    });

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN");
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it("멤버십 query가 실패하면 500을 반환하고 project query를 실행하지 않는다", async () => {
    const { projectQuery, documentQuery, documentUpdate } = mockWhiteboardDocumentUpdateTransaction(
      {
        membershipError: new Error("membership query failed"),
      },
    );

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(projectQuery.from).not.toHaveBeenCalled();
    expect(documentQuery.from).not.toHaveBeenCalled();
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it("project query가 실패하면 500을 반환하고 document query를 실행하지 않는다", async () => {
    const { documentQuery, documentUpdate } = mockWhiteboardDocumentUpdateTransaction({
      projectError: new Error("project query failed"),
    });

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(documentQuery.from).not.toHaveBeenCalled();
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it("document query가 실패하면 500을 반환하고 update하지 않는다", async () => {
    const { documentUpdate } = mockWhiteboardDocumentUpdateTransaction({
      documentError: new Error("document query failed"),
    });

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it("document update query가 실패하면 500을 반환한다", async () => {
    const { documentUpdate } = mockWhiteboardDocumentUpdateTransaction({
      updateError: new Error("document update failed"),
    });

    const response = await request(createApp())
      .patch(patchPath)
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "변경된 문서 이름" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(documentUpdate.set).toHaveBeenCalledWith({
      name: "변경된 문서 이름",
      updatedAt: expect.any(Date),
    });
  });
});

describe("DELETE /workspaces/:workspaceId/projects/:projectId/whiteboard-documents/:documentId", () => {
  const deletePath = `/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents/${createdWhiteboardDocument.id}`;

  it("Owner가 다른 Creator의 문서를 삭제하고 204를 반환한다", async () => {
    const { documentQuery, documentUpdate, transaction } =
      mockWhiteboardDocumentDeleteTransaction();

    const response = await request(createApp())
      .delete(deletePath)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(transaction.select).toHaveBeenCalledTimes(3);
    expect(documentQuery.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
        eq(whiteboardDocuments.projectId, projectId),
        isNull(whiteboardDocuments.deletedAt),
      ),
    );
    expect(documentUpdate.set).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });

    const values = documentUpdate.set.mock.calls[0]?.[0] as {
      deletedAt: Date;
      updatedAt: Date;
    };
    expect(values.deletedAt).toEqual(values.updatedAt);
    expect(documentUpdate.where).toHaveBeenCalledWith(
      and(
        eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
        eq(whiteboardDocuments.projectId, projectId),
        isNull(whiteboardDocuments.deletedAt),
      ),
    );
    expect(documentUpdate.returning).toHaveBeenCalledWith({ id: whiteboardDocuments.id });
  });

  it("문서 Creator인 Member가 자신의 문서를 삭제할 수 있다", async () => {
    const { documentUpdate } = mockWhiteboardDocumentDeleteTransaction({
      membershipRows: [{ role: "member" }],
      documentRows: [{ id: createdWhiteboardDocument.id, creatorId: "user-1" }],
    });

    const response = await request(createApp())
      .delete(deletePath)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(204);
    expect(documentUpdate.set).toHaveBeenCalledOnce();
  });

  it("인증이 없으면 401을 반환하고 transaction을 호출하지 않는다", async () => {
    const response = await request(createApp()).delete(deletePath);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "workspaceId",
      pathWorkspaceId: "not-a-uuid",
      pathProjectId: projectId,
      pathDocumentId: createdWhiteboardDocument.id,
    },
    {
      label: "projectId",
      pathWorkspaceId: workspaceId,
      pathProjectId: "not-a-uuid",
      pathDocumentId: createdWhiteboardDocument.id,
    },
    {
      label: "documentId",
      pathWorkspaceId: workspaceId,
      pathProjectId: projectId,
      pathDocumentId: "not-a-uuid",
    },
  ])(
    "$label - UUID가 아니면 400을 반환하고 transaction을 호출하지 않는다",
    async ({ pathWorkspaceId, pathProjectId, pathDocumentId }) => {
      const response = await request(createApp())
        .delete(
          `/workspaces/${pathWorkspaceId}/projects/${pathProjectId}/whiteboard-documents/${pathDocumentId}`,
        )
        .set("Authorization", `Bearer ${await createAccessToken()}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(db.transaction).not.toHaveBeenCalled();
    },
  );

  it("멤버십 rows가 비어 있으면 404 WORKSPACE_NOT_FOUND를 반환하고 이후 query를 실행하지 않는다", async () => {
    const { projectQuery, documentQuery, documentUpdate, transaction } =
      mockWhiteboardDocumentDeleteTransaction({
        membershipRows: [],
      });

    const response = await request(createApp())
      .delete(deletePath)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(transaction.update).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(projectQuery.from).not.toHaveBeenCalled();
    expect(documentQuery.from).not.toHaveBeenCalled();
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it("project rows가 비어 있으면 404 PROJECT_NOT_FOUND를 반환하고 document/update query를 실행하지 않는다", async () => {
    const { documentQuery, documentUpdate, transaction } = mockWhiteboardDocumentDeleteTransaction({
      projectRows: [],
    });

    const response = await request(createApp())
      .delete(deletePath)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(transaction.update).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("PROJECT_NOT_FOUND");
    expect(documentQuery.from).not.toHaveBeenCalled();
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it.each(["문서가 없을 때", "이미 삭제된 문서일 때"])(
    "%s 404 WHITEBOARD_DOCUMENT_NOT_FOUND를 반환하고 update하지 않는다",
    async () => {
      const { documentQuery, documentUpdate, transaction } =
        mockWhiteboardDocumentDeleteTransaction({
          documentRows: [],
        });

      const response = await request(createApp())
        .delete(deletePath)
        .set("Authorization", `Bearer ${await createAccessToken()}`);

      expect(transaction.update).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe("WHITEBOARD_DOCUMENT_NOT_FOUND");
      expect(documentQuery.where).toHaveBeenCalledWith(
        and(
          eq(whiteboardDocuments.id, createdWhiteboardDocument.id),
          eq(whiteboardDocuments.projectId, projectId),
          isNull(whiteboardDocuments.deletedAt),
        ),
      );
      expect(documentUpdate.set).not.toHaveBeenCalled();
    },
  );

  it("문서 Creator가 아닌 Member는 403을 반환하고 delete하지 않는다", async () => {
    const { documentUpdate, transaction } = mockWhiteboardDocumentDeleteTransaction({
      membershipRows: [{ role: "member" }],
      documentRows: [{ id: createdWhiteboardDocument.id, creatorId: "user-2" }],
    });

    const response = await request(createApp())
      .delete(deletePath)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(transaction.update).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN");
    expect(documentUpdate.set).not.toHaveBeenCalled();
  });

  it.each([
    { label: "membership", options: { membershipError: new Error("membership query failed") } },
    { label: "project", options: { projectError: new Error("project query failed") } },
    { label: "document", options: { documentError: new Error("document query failed") } },
    { label: "delete", options: { deleteError: new Error("document delete failed") } },
  ])("$label query가 실패하면 500을 반환한다", async ({ options }) => {
    mockWhiteboardDocumentDeleteTransaction(options);

    const response = await request(createApp())
      .delete(deletePath)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });

  it("delete returning row가 없으면 404 WHITEBOARD_DOCUMENT_NOT_FOUND를 반환한다", async () => {
    const { documentUpdate } = mockWhiteboardDocumentDeleteTransaction({
      deletedDocumentRows: [],
    });

    const response = await request(createApp())
      .delete(deletePath)
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WHITEBOARD_DOCUMENT_NOT_FOUND");
    expect(documentUpdate.set).toHaveBeenCalledWith({
      deletedAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
  });
});
