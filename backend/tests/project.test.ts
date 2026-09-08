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

  vi.mocked(db.transaction).mockImplementation(async (callback) => callback(transaction as never));

  return { membershipQuery, projectInsert, transaction };
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
