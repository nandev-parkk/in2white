import { and, eq } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import { projects, workspaceMemberships } from "@/db/schema";
import { HttpError } from "@/utils/http-error";

export interface CreateProjectInput {
  workspaceId: string;
  name: string;
  description: string | null;
  creatorId: string;
}

export async function createProject({
  workspaceId,
  name,
  description,
  creatorId,
}: CreateProjectInput): Promise<typeof projects.$inferSelect> {
  return db.transaction(async (tx) => {
    const [membership] = await tx
      .select({ id: workspaceMemberships.id })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, creatorId),
        ),
      );

    if (!membership) {
      throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }

    const [project] = await tx
      .insert(projects)
      .values({ workspaceId, name, description, creatorId })
      .returning();

    if (!project) {
      throw new Error("Project insert returned no row");
    }

    return project;
  });
}
