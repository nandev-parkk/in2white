import { and, asc, desc, eq } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import { workspaceMemberships, workspaces } from "@/db/schema";
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
