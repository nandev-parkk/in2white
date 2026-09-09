import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, isNull } from "drizzle-orm";
import { createApp } from "@/app";
import { db } from "@/db/client";
import { projects, whiteboardDocuments, workspaceMemberships } from "@/db/schema";
import { signAccessToken } from "@/lib/jwt";

vi.mock("@/db/client", () => ({
  db: {
    transaction: vi.fn(),
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
