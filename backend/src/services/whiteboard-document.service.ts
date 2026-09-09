import { and, asc, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import { projects, users, whiteboardDocuments, workspaceMemberships } from "@/db/schema";
import { HttpError } from "@/utils/http-error";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { buildContainsSearchPattern } from "@/utils/search";

import type { PaginationMeta } from "@/utils/pagination";

export interface CreateWhiteboardDocumentInput {
  workspaceId: string;
  projectId: string;
  name: string;
  creatorId: string;
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
