import { and, eq, isNull } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import { projects, whiteboardDocuments, workspaceMemberships } from "@/db/schema";
import { HttpError } from "@/utils/http-error";

export interface CreateWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  name: string;
  creatorId: string;
}

export async function createWhiteboardDocument({
  workspaceId,
  projectId,
  name,
  creatorId,
}: CreateWhiteboardDocumentInput): Promise<typeof whiteboardDocuments.$inferSelect> {
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
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.workspaceId, workspaceId),
          isNull(projects.deletedAt),
        ),
      );

    if (!project) {
      throw new HttpError(404, "PROJECT_NOT_FOUND", ERROR_MESSAGES.PROJECT_NOT_FOUND);
    }

    const [whiteboardDocument] = await tx
      .insert(whiteboardDocuments)
      .values({ projectId, name, creatorId })
      .returning();

    if (!whiteboardDocument) {
      throw new Error("Whiteboard document insert returned no row");
    }

    return whiteboardDocument;
  });
}
