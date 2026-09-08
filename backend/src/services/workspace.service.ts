import { and, asc, count, desc, eq } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import { projects, users, workspaceMemberships, workspaces } from "@/db/schema";
import { HttpError } from "@/utils/http-error";

export interface CreateWorkspaceInput {
  name: string;
  ownerId: string;
}

export interface UpdateWorkspaceInput {
  workspaceId: string;
  name: string;
  userId: string;
}

export type WorkspaceListItem = typeof workspaces.$inferSelect & {
  role: (typeof workspaceMemberships.$inferSelect)["role"];
};

export interface GetWorkspaceDetailInput {
  workspaceId: string;
  userId: string;
}

export interface WorkspacePermissions {
  canRename: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
  canCreateProject: boolean;
  canViewMembers: boolean;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  owner: {
    id: string;
    name: string;
  };
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: (typeof workspaceMemberships.$inferSelect)["role"];
  permissions: WorkspacePermissions;
  counts: {
    memberCount: number;
    projectCount: number;
  };
}

export async function listWorkspaces(userId: string): Promise<WorkspaceListItem[]> {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      isDefault: workspaces.isDefault,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMemberships.role,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .where(eq(workspaceMemberships.userId, userId))
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt), asc(workspaces.id));
}

export async function getWorkspaceDetail({
  workspaceId,
  userId,
}: GetWorkspaceDetailInput): Promise<WorkspaceDetail> {
  const [workspace] = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: users.id,
      ownerName: users.name,
      isDefault: workspaces.isDefault,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      role: workspaceMemberships.role,
    })
    .from(workspaceMemberships)
    .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
      ),
    );

  if (!workspace) {
    throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
  }

  const [[memberCount], [projectCount]] = await Promise.all([
    db
      .select({ memberCount: count() })
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.workspaceId, workspaceId)),
    db
      .select({ projectCount: count() })
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId)),
  ]);

  const isOwner = workspace.role === "owner";

  return {
    id: workspace.id,
    name: workspace.name,
    owner: { id: workspace.ownerId, name: workspace.ownerName },
    isDefault: workspace.isDefault,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    role: workspace.role,
    permissions: {
      canRename: isOwner,
      canDelete: isOwner && !workspace.isDefault,
      canManageMembers: isOwner,
      canCreateProject: true,
      canViewMembers: true,
    },
    counts: {
      memberCount: Number(memberCount?.memberCount ?? 0),
      projectCount: Number(projectCount?.projectCount ?? 0),
    },
  };
}

export async function createWorkspace({
  name,
  ownerId,
}: CreateWorkspaceInput): Promise<typeof workspaces.$inferSelect> {
  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name, ownerId, isDefault: false })
      .returning();

    if (!workspace) {
      throw new Error("Workspace insert returned no row");
    }

    await tx.insert(workspaceMemberships).values({
      workspaceId: workspace.id,
      userId: ownerId,
      role: "owner",
    });

    return workspace;
  });
}

export async function updateWorkspace({
  workspaceId,
  name,
  userId,
}: UpdateWorkspaceInput): Promise<typeof workspaces.$inferSelect> {
  return db.transaction(async (tx) => {
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

    if (membership.role !== "owner") {
      throw new HttpError(
        403,
        "WORKSPACE_UPDATE_FORBIDDEN",
        ERROR_MESSAGES.WORKSPACE_UPDATE_FORBIDDEN,
      );
    }

    const [workspace] = await tx
      .update(workspaces)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, userId)))
      .returning();

    if (!workspace) {
      throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }

    return workspace;
  });
}

export interface DeleteWorkspaceInput {
  workspaceId: string;
  userId: string;
}

export async function deleteWorkspace({
  workspaceId,
  userId,
}: DeleteWorkspaceInput): Promise<void> {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ role: workspaceMemberships.role, isDefault: workspaces.isDefault })
      .from(workspaceMemberships)
      .innerJoin(workspaces, eq(workspaceMemberships.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, userId),
        ),
      );

    if (!membership) {
      throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }

    if (membership.role !== "owner") {
      throw new HttpError(
        403,
        "WORKSPACE_DELETE_FORBIDDEN",
        ERROR_MESSAGES.WORKSPACE_DELETE_FORBIDDEN,
      );
    }

    if (membership.isDefault) {
      throw new HttpError(
        400,
        "WORKSPACE_DEFAULT_DELETE_FORBIDDEN",
        ERROR_MESSAGES.WORKSPACE_DEFAULT_DELETE_FORBIDDEN,
      );
    }

    const [deleted] = await tx
      .delete(workspaces)
      .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, userId)))
      .returning({ id: workspaces.id });

    if (!deleted) {
      throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }
  });
}
