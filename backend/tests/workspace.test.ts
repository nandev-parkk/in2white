import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { and, asc, desc, eq } from "drizzle-orm";
import { createApp } from "@/app";
import { db } from "@/db/client";
import { signAccessToken } from "@/lib/jwt";
import { workspaceMemberships, workspaces } from "@/db/schema";

vi.mock("@/db/client", () => ({
  db: {
    transaction: vi.fn(),
    select: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(db.transaction).mockReset();
  vi.mocked(db.select).mockReset();
});

function mockWorkspaceListQuery(rows: unknown[]) {
  const query = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };

  vi.mocked(db.select).mockReturnValue(query as never);
  return query;
}

async function createAccessToken() {
  return signAccessToken({
    sub: "user-1",
    email: "user@example.com",
    sid: "session-1",
  });
}

describe("POST /workspaces", () => {
  it("creates a workspace and owner membership in one transaction", async () => {
    const createdWorkspace = {
      id: "workspace-1",
      name: "Brand Studio",
      ownerId: "user-1",
      isDefault: false,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      updatedAt: new Date("2026-09-07T00:05:00.000Z"),
    };
    const workspaceInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([createdWorkspace]),
    };
    const membershipInsert = {
      values: vi.fn().mockResolvedValue([]),
    };
    const transaction = {
      insert: vi.fn((table: unknown) =>
        table === workspaces ? workspaceInsert : membershipInsert,
      ),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );

    const response = await request(createApp())
      .post("/workspaces")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Brand Studio" });

    expect(response.status).toBe(201);
    expect(response.body.workspace).toEqual({
      ...createdWorkspace,
      createdAt: createdWorkspace.createdAt.toISOString(),
      updatedAt: createdWorkspace.updatedAt.toISOString(),
    });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(workspaceInsert.values).toHaveBeenCalledWith({
      name: "Brand Studio",
      ownerId: "user-1",
      isDefault: false,
    });
    expect(membershipInsert.values).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      userId: "user-1",
      role: "owner",
    });
  });

  it("returns 401 when the request is not authenticated", async () => {
    const response = await request(createApp()).post("/workspaces").send({ name: "Brand Studio" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace name is blank", async () => {
    const response = await request(createApp())
      .post("/workspaces")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace name exceeds 255 characters", async () => {
    const response = await request(createApp())
      .post("/workspaces")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "a".repeat(256) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 500 when creating the owner membership fails", async () => {
    const workspaceInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([
        {
          id: "workspace-1",
          name: "Brand Studio",
          ownerId: "user-1",
          isDefault: false,
          createdAt: new Date("2026-09-07T00:00:00.000Z"),
        },
      ]),
    };
    const membershipInsert = {
      values: vi.fn().mockRejectedValue(new Error("membership insert failed")),
    };
    const transaction = {
      insert: vi.fn((table: unknown) =>
        table === workspaces ? workspaceInsert : membershipInsert,
      ),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );

    const response = await request(createApp())
      .post("/workspaces")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Brand Studio" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("GET /workspaces", () => {
  it("returns the authenticated user's workspaces with membership roles", async () => {
    const createdAt = new Date("2026-09-07T00:00:00.000Z");
    const updatedAt = new Date("2026-09-07T00:05:00.000Z");
    const query = mockWorkspaceListQuery([
      {
        id: "workspace-default",
        name: "My Workspace",
        ownerId: "user-1",
        isDefault: true,
        createdAt,
        updatedAt,
        role: "owner",
      },
      {
        id: "workspace-member",
        name: "Brand Studio",
        ownerId: "user-2",
        isDefault: false,
        createdAt,
        updatedAt,
        role: "member",
      },
    ]);

    const response = await request(createApp())
      .get("/workspaces")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body.workspaces).toEqual([
      {
        id: "workspace-default",
        name: "My Workspace",
        ownerId: "user-1",
        isDefault: true,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        role: "owner",
      },
      {
        id: "workspace-member",
        name: "Brand Studio",
        ownerId: "user-2",
        isDefault: false,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        role: "member",
      },
    ]);
    expect(db.select).toHaveBeenCalledOnce();
    expect(db.select.mock.calls[0]?.[0]).toStrictEqual({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      isDefault: workspaces.isDefault,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMemberships.role,
    });
    expect(query.from).toHaveBeenCalledOnce();
    expect(query.innerJoin).toHaveBeenCalledOnce();
    expect(query.where).toHaveBeenCalledOnce();
    expect(query.orderBy).toHaveBeenCalledOnce();
    expect(query.where).toHaveBeenCalledWith(eq(workspaceMemberships.userId, "user-1"));
    expect(query.orderBy).toHaveBeenCalledWith(
      desc(workspaces.isDefault),
      asc(workspaces.createdAt),
      asc(workspaces.id),
    );
    expect(query.from.mock.invocationCallOrder[0]).toBeLessThan(
      query.innerJoin.mock.invocationCallOrder[0],
    );
    expect(query.innerJoin.mock.invocationCallOrder[0]).toBeLessThan(
      query.where.mock.invocationCallOrder[0],
    );
    expect(query.where.mock.invocationCallOrder[0]).toBeLessThan(
      query.orderBy.mock.invocationCallOrder[0],
    );
  });

  it("returns an empty array when the user has no workspace memberships", async () => {
    mockWorkspaceListQuery([]);

    const response = await request(createApp())
      .get("/workspaces")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ workspaces: [] });
  });

  it("returns 401 when the request is not authenticated", async () => {
    const response = await request(createApp()).get("/workspaces");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.select).not.toHaveBeenCalled();
  });

  it("returns 500 when listing workspaces fails", async () => {
    const query = mockWorkspaceListQuery([]);
    query.orderBy.mockRejectedValueOnce(new Error("workspace list failed"));

    const response = await request(createApp())
      .get("/workspaces")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("PATCH /workspaces/:workspaceId", () => {
  function mockWorkspaceUpdateTransaction({
    membershipRows = [{ role: "owner" as const }],
    updateRows = [
      {
        id: "workspace-1",
        name: "Renamed Workspace",
        ownerId: "user-1",
        isDefault: false,
        createdAt: new Date("2026-09-07T00:00:00.000Z"),
        updatedAt: new Date("2026-09-07T00:05:00.000Z"),
      },
    ],
    updateError,
  }: {
    membershipRows?: Array<{ role: "owner" | "member" }>;
    updateRows?: unknown[];
    updateError?: Error;
  } = {}) {
    const membershipQuery = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(membershipRows),
    };
    const workspaceUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: updateError
        ? vi.fn().mockRejectedValue(updateError)
        : vi.fn().mockResolvedValue(updateRows),
    };
    const transaction = {
      select: vi.fn().mockReturnValue(membershipQuery),
      update: vi.fn().mockReturnValue(workspaceUpdate),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );

    return { membershipQuery, transaction, workspaceUpdate };
  }

  it("updates an owned workspace and returns the trimmed name", async () => {
    const updatedWorkspace = {
      id: "workspace-1",
      name: "Renamed Workspace",
      ownerId: "user-1",
      isDefault: false,
      createdAt: new Date("2026-09-07T00:00:00.000Z"),
      updatedAt: new Date("2026-09-07T00:05:00.000Z"),
    };
    const { membershipQuery, transaction, workspaceUpdate } = mockWorkspaceUpdateTransaction({
      updateRows: [updatedWorkspace],
    });

    const response = await request(createApp())
      .patch("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "  Renamed Workspace  " });

    expect(response.status).toBe(200);
    expect(response.body.workspace).toEqual({
      ...updatedWorkspace,
      createdAt: updatedWorkspace.createdAt.toISOString(),
      updatedAt: updatedWorkspace.updatedAt.toISOString(),
    });
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transaction.select).toHaveBeenCalledOnce();
    expect(transaction.select).toHaveBeenCalledWith({ role: workspaceMemberships.role });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, "workspace-1"),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );
    expect(transaction.update).toHaveBeenCalledWith(workspaces);
    expect(workspaceUpdate.set).toHaveBeenCalledWith({
      name: "Renamed Workspace",
      updatedAt: expect.any(Date),
    });
    expect(workspaceUpdate.where).toHaveBeenCalledWith(
      and(eq(workspaces.id, "workspace-1"), eq(workspaces.ownerId, "user-1")),
    );
  });

  it("returns 401 when the request is not authenticated", async () => {
    const response = await request(createApp())
      .patch("/workspaces/workspace-1")
      .send({ name: "Renamed Workspace" });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace name is blank", async () => {
    const response = await request(createApp())
      .patch("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "   " });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace name exceeds 255 characters", async () => {
    const response = await request(createApp())
      .patch("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "a".repeat(256) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is not a workspace member", async () => {
    const { transaction } = mockWorkspaceUpdateTransaction({ membershipRows: [] });

    const response = await request(createApp())
      .patch("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Renamed Workspace" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is a workspace member without update permission", async () => {
    const { transaction } = mockWorkspaceUpdateTransaction({
      membershipRows: [{ role: "member" }],
    });

    const response = await request(createApp())
      .patch("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Renamed Workspace" });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("WORKSPACE_UPDATE_FORBIDDEN");
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it("returns 404 when the workspace update returns no row", async () => {
    const { workspaceUpdate } = mockWorkspaceUpdateTransaction({ updateRows: [] });

    const response = await request(createApp())
      .patch("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Renamed Workspace" });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(workspaceUpdate.returning).toHaveBeenCalledOnce();
  });

  it("returns 500 when updating the workspace fails", async () => {
    mockWorkspaceUpdateTransaction({ updateError: new Error("workspace update failed") });

    const response = await request(createApp())
      .patch("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`)
      .send({ name: "Renamed Workspace" });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("DELETE /workspaces/:workspaceId", () => {
  function mockWorkspaceDeleteTransaction({
    membershipRows = [{ role: "owner" as const, isDefault: false }],
    deleteRows = [{ id: "workspace-1" }],
    deleteError,
  }: {
    membershipRows?: Array<{ role: "owner" | "member"; isDefault: boolean }>;
    deleteRows?: unknown[];
    deleteError?: Error;
  } = {}) {
    const membershipQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(membershipRows),
    };
    const workspaceDelete = {
      where: vi.fn().mockReturnThis(),
      returning: deleteError
        ? vi.fn().mockRejectedValue(deleteError)
        : vi.fn().mockResolvedValue(deleteRows),
    };
    const transaction = {
      select: vi.fn().mockReturnValue(membershipQuery),
      delete: vi.fn().mockReturnValue(workspaceDelete),
    };

    vi.mocked(db.transaction).mockImplementation(async (callback) =>
      callback(transaction as never),
    );

    return { membershipQuery, transaction, workspaceDelete };
  }

  it("deletes an owned non-default workspace and returns 204", async () => {
    const { membershipQuery, transaction, workspaceDelete } = mockWorkspaceDeleteTransaction();

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(transaction.select).toHaveBeenCalledWith({
      role: workspaceMemberships.role,
      isDefault: workspaces.isDefault,
    });
    expect(membershipQuery.from).toHaveBeenCalledWith(workspaceMemberships);
    expect(membershipQuery.innerJoin).toHaveBeenCalledWith(
      workspaces,
      eq(workspaceMemberships.workspaceId, workspaces.id),
    );
    expect(membershipQuery.where).toHaveBeenCalledWith(
      and(
        eq(workspaceMemberships.workspaceId, "workspace-1"),
        eq(workspaceMemberships.userId, "user-1"),
      ),
    );
    expect(transaction.delete).toHaveBeenCalledWith(workspaces);
    expect(workspaceDelete.where).toHaveBeenCalledWith(
      and(eq(workspaces.id, "workspace-1"), eq(workspaces.ownerId, "user-1")),
    );
  });

  it("returns 401 when the request is not authenticated", async () => {
    const response = await request(createApp()).delete("/workspaces/workspace-1");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is not a workspace member", async () => {
    const { transaction } = mockWorkspaceDeleteTransaction({ membershipRows: [] });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is a workspace member without owner role", async () => {
    const { transaction } = mockWorkspaceDeleteTransaction({
      membershipRows: [{ role: "member", isDefault: false }],
    });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("WORKSPACE_DELETE_FORBIDDEN");
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it("returns 400 when the workspace is the default workspace", async () => {
    const { transaction } = mockWorkspaceDeleteTransaction({
      membershipRows: [{ role: "owner", isDefault: true }],
    });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("WORKSPACE_DEFAULT_DELETE_FORBIDDEN");
    expect(transaction.delete).not.toHaveBeenCalled();
  });

  it("returns 404 when the workspace delete returns no row", async () => {
    const { workspaceDelete } = mockWorkspaceDeleteTransaction({ deleteRows: [] });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("WORKSPACE_NOT_FOUND");
    expect(workspaceDelete.returning).toHaveBeenCalledOnce();
  });

  it("returns 500 when deleting the workspace fails", async () => {
    mockWorkspaceDeleteTransaction({ deleteError: new Error("workspace delete failed") });

    const response = await request(createApp())
      .delete("/workspaces/workspace-1")
      .set("Authorization", `Bearer ${await createAccessToken()}`);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});
