import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import {
  projects,
  users,
  whiteboardDocumentContents,
  whiteboardDocuments,
  workspaceMemberships,
} from "@/db/schema";
import {
  EMPTY_CANVAS_CONTENT,
  normalizeCanvasContent,
} from "@/services/whiteboard-document-content.service";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { buildContainsSearchPattern } from "@/utils/search";

import type { PaginationMeta } from "@/utils/pagination";
import type { CanvasContent } from "@/types/whiteboard";

export interface CreateWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  name: string;
  creatorId: string;
}

export type CreatedWhiteboardDocument = Pick<
  typeof whiteboardDocuments.$inferSelect,
  "id" | "projectId" | "name" | "creatorId" | "createdAt" | "updatedAt"
> & {
  canvasContent: CanvasContent;
  revision: number;
  lastSavedAt: Date;
};

export interface GetWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  documentId: string;
  userId: string;
}

export type WhiteboardDocumentDetail = Pick<
  typeof whiteboardDocuments.$inferSelect,
  "id" | "projectId" | "name" | "creatorId" | "createdAt" | "updatedAt"
> & {
  canvasContent: CanvasContent;
  revision: number;
  lastSavedAt: Date;
};

export interface UpdateWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  documentId: string;
  userId: string;
  name: string;
}

export interface DeleteWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  documentId: string;
  userId: string;
}

export interface UpdatedWhiteboardDocument {
  id: string;
  name: string;
  updatedAt: Date;
}

export interface ListWhiteboardDocumentsInput {
  workspaceId: string;
  projectId: string;
  userId: string;
  search?: string;
  page: number;
  limit: number;
}

export interface WhiteboardDocumentListItem {
  id: string;
  projectId: string;
  name: string;
  creatorId: string;
  creator: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface ListWhiteboardDocumentsResult {
  whiteboardDocuments: WhiteboardDocumentListItem[];
  pagination: PaginationMeta;
}

export async function createWhiteboardDocument({
  workspaceId,
  projectId,
  name,
  creatorId,
}: CreateWhiteboardDocumentInput): Promise<CreatedWhiteboardDocument> {
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
      .returning({
        id: whiteboardDocuments.id,
        projectId: whiteboardDocuments.projectId,
        name: whiteboardDocuments.name,
        creatorId: whiteboardDocuments.creatorId,
        createdAt: whiteboardDocuments.createdAt,
        updatedAt: whiteboardDocuments.updatedAt,
      });

    if (!whiteboardDocument) {
      throw new Error("Whiteboard document insert returned no row");
    }

    const [content] = await tx
      .insert(whiteboardDocumentContents)
      .values({
        documentId: whiteboardDocument.id,
        canvasContent: EMPTY_CANVAS_CONTENT,
        revision: 0,
      })
      .returning({ updatedAt: whiteboardDocumentContents.updatedAt });

    if (!content) {
      throw new Error("Whiteboard document content insert returned no row");
    }

    return {
      ...whiteboardDocument,
      canvasContent: EMPTY_CANVAS_CONTENT,
      revision: 0,
      lastSavedAt: content.updatedAt,
    };
  });
}

export async function getWhiteboardDocument({
  workspaceId,
  projectId,
  documentId,
  userId,
}: GetWhiteboardDocumentInput): Promise<WhiteboardDocumentDetail> {
  const [membership] = await db
    .select({ id: workspaceMemberships.id })
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

  const [project] = await db
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

  const [whiteboardDocument] = await db
    .select({
      id: whiteboardDocuments.id,
      projectId: whiteboardDocuments.projectId,
      name: whiteboardDocuments.name,
      creatorId: whiteboardDocuments.creatorId,
      createdAt: whiteboardDocuments.createdAt,
      updatedAt: whiteboardDocuments.updatedAt,
      canvasContent: whiteboardDocumentContents.canvasContent,
      revision: whiteboardDocumentContents.revision,
      lastSavedAt: whiteboardDocumentContents.updatedAt,
    })
    .from(whiteboardDocuments)
    .leftJoin(
      whiteboardDocumentContents,
      eq(whiteboardDocumentContents.documentId, whiteboardDocuments.id),
    )
    .where(
      and(
        eq(whiteboardDocuments.id, documentId),
        eq(whiteboardDocuments.projectId, projectId),
        isNull(whiteboardDocuments.deletedAt),
      ),
    );

  if (!whiteboardDocument) {
    throw new HttpError(
      404,
      "WHITEBOARD_DOCUMENT_NOT_FOUND",
      ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
    );
  }

  if (
    whiteboardDocument.canvasContent === null ||
    whiteboardDocument.revision === null ||
    whiteboardDocument.lastSavedAt === null
  ) {
    logger.error({ documentId }, "Whiteboard document content row is missing");
    throw new HttpError(500, "CONTENT_INTEGRITY_ERROR", ERROR_MESSAGES.CONTENT_INTEGRITY_ERROR);
  }

  return {
    id: whiteboardDocument.id,
    projectId: whiteboardDocument.projectId,
    name: whiteboardDocument.name,
    creatorId: whiteboardDocument.creatorId,
    canvasContent: normalizeCanvasContent(whiteboardDocument.canvasContent),
    revision: whiteboardDocument.revision,
    lastSavedAt: whiteboardDocument.lastSavedAt,
    createdAt: whiteboardDocument.createdAt,
    updatedAt: whiteboardDocument.updatedAt,
  };
}

export async function updateWhiteboardDocument({
  workspaceId,
  projectId,
  documentId,
  userId,
  name,
}: UpdateWhiteboardDocumentInput): Promise<UpdatedWhiteboardDocument> {
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
      .select({ id: whiteboardDocuments.id, creatorId: whiteboardDocuments.creatorId })
      .from(whiteboardDocuments)
      .where(
        and(
          eq(whiteboardDocuments.id, documentId),
          eq(whiteboardDocuments.projectId, projectId),
          isNull(whiteboardDocuments.deletedAt),
        ),
      );

    if (!whiteboardDocument) {
      throw new HttpError(
        404,
        "WHITEBOARD_DOCUMENT_NOT_FOUND",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
      );
    }

    if (membership.role !== "owner" && whiteboardDocument.creatorId !== userId) {
      throw new HttpError(
        403,
        "WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_UPDATE_FORBIDDEN,
      );
    }

    const [updatedWhiteboardDocument] = await tx
      .update(whiteboardDocuments)
      .set({ name, updatedAt: new Date() })
      .where(
        and(
          eq(whiteboardDocuments.id, documentId),
          eq(whiteboardDocuments.projectId, projectId),
          isNull(whiteboardDocuments.deletedAt),
        ),
      )
      .returning({
        id: whiteboardDocuments.id,
        name: whiteboardDocuments.name,
        updatedAt: whiteboardDocuments.updatedAt,
      });

    if (!updatedWhiteboardDocument) {
      throw new HttpError(
        404,
        "WHITEBOARD_DOCUMENT_NOT_FOUND",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
      );
    }

    return updatedWhiteboardDocument;
  });
}

export async function listWhiteboardDocuments({
  workspaceId,
  projectId,
  userId,
  search,
  page,
  limit,
}: ListWhiteboardDocumentsInput): Promise<ListWhiteboardDocumentsResult> {
  const [membership] = await db
    .select({ id: workspaceMemberships.id })
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

  const [project] = await db
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

  const whereCondition = and(
    eq(whiteboardDocuments.projectId, projectId),
    isNull(whiteboardDocuments.deletedAt),
    search ? ilike(whiteboardDocuments.name, buildContainsSearchPattern(search)) : undefined,
  );

  const [countRows, whiteboardDocumentRows] = await Promise.all([
    db.select({ total: count() }).from(whiteboardDocuments).where(whereCondition),
    db
      .select({
        id: whiteboardDocuments.id,
        projectId: whiteboardDocuments.projectId,
        name: whiteboardDocuments.name,
        creatorId: whiteboardDocuments.creatorId,
        creator: { id: users.id, name: users.name },
        createdAt: whiteboardDocuments.createdAt,
        updatedAt: whiteboardDocuments.updatedAt,
      })
      .from(whiteboardDocuments)
      .innerJoin(users, eq(whiteboardDocuments.creatorId, users.id))
      .where(whereCondition)
      .orderBy(
        desc(whiteboardDocuments.updatedAt),
        desc(whiteboardDocuments.createdAt),
        asc(whiteboardDocuments.id),
      )
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return {
    whiteboardDocuments: whiteboardDocumentRows,
    pagination: createPaginationMeta({ page, limit, total }),
  };
}

export async function deleteWhiteboardDocument({
  workspaceId,
  projectId,
  documentId,
  userId,
}: DeleteWhiteboardDocumentInput): Promise<void> {
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
      .select({ id: whiteboardDocuments.id, creatorId: whiteboardDocuments.creatorId })
      .from(whiteboardDocuments)
      .where(
        and(
          eq(whiteboardDocuments.id, documentId),
          eq(whiteboardDocuments.projectId, projectId),
          isNull(whiteboardDocuments.deletedAt),
        ),
      );

    if (!whiteboardDocument) {
      throw new HttpError(
        404,
        "WHITEBOARD_DOCUMENT_NOT_FOUND",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
      );
    }

    if (membership.role !== "owner" && whiteboardDocument.creatorId !== userId) {
      throw new HttpError(
        403,
        "WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_DELETE_FORBIDDEN,
      );
    }

    const now = new Date();
    const [deletedWhiteboardDocument] = await tx
      .update(whiteboardDocuments)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(whiteboardDocuments.id, documentId),
          eq(whiteboardDocuments.projectId, projectId),
          isNull(whiteboardDocuments.deletedAt),
        ),
      )
      .returning({ id: whiteboardDocuments.id });

    if (!deletedWhiteboardDocument) {
      throw new HttpError(
        404,
        "WHITEBOARD_DOCUMENT_NOT_FOUND",
        ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
      );
    }
  });
}
