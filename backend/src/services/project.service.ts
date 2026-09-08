import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import { projects, users, workspaceMemberships } from "@/db/schema";
import { HttpError } from "@/utils/http-error";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { buildContainsSearchPattern } from "@/utils/search";

import type { PaginationMeta } from "@/utils/pagination";

export interface ListProjectsInput {
  workspaceId: string;
  userId: string;
  search?: string;
  page: number;
  limit: number;
}

export interface ProjectListItem {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  creatorId: string;
  creator: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface ListProjectsResult {
  projects: ProjectListItem[];
  pagination: PaginationMeta;
}

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

export async function listProjects({
  workspaceId,
  userId,
  search,
  page,
  limit,
}: ListProjectsInput): Promise<ListProjectsResult> {
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

  const whereCondition = and(
    eq(projects.workspaceId, workspaceId),
    search ? ilike(projects.name, buildContainsSearchPattern(search)) : undefined,
  );

  const [countRows, projectRows] = await Promise.all([
    db.select({ total: count() }).from(projects).where(whereCondition),
    db
      .select({
        id: projects.id,
        workspaceId: projects.workspaceId,
        name: projects.name,
        description: projects.description,
        creatorId: projects.creatorId,
        creator: { id: users.id, name: users.name },
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(users, eq(projects.creatorId, users.id))
      .where(whereCondition)
      .orderBy(desc(projects.updatedAt), desc(projects.createdAt), asc(projects.id))
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return {
    projects: projectRows,
    pagination: createPaginationMeta({ page, limit, total }),
  };
}
