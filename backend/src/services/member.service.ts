import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import { users, workspaceMemberships } from "@/db/schema";
import { HttpError } from "@/utils/http-error";
import type { PaginationMeta } from "@/utils/pagination";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { buildContainsSearchPattern } from "@/utils/search";

export interface ListMembersInput {
  workspaceId: string;
  requesterId: string;
  search?: string;
  page: number;
  limit: number;
}

export interface MemberListItem {
  userId: string;
  name: string;
  email: string;
  role: (typeof workspaceMemberships.$inferSelect)["role"];
  joinedAt: Date;
}

export interface ListMembersResult {
  members: MemberListItem[];
  pagination: PaginationMeta;
}

export interface AddMemberInput {
  workspaceId: string;
  requesterId: string;
  userId: string;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function addMember({
  workspaceId,
  requesterId,
  userId,
}: AddMemberInput): Promise<MemberListItem> {
  return db.transaction(async (tx) => {
    const [requesterMembership] = await tx
      .select({ role: workspaceMemberships.role })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, requesterId),
        ),
      );

    if (!requesterMembership) {
      throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
    }

    if (requesterMembership.role !== "owner") {
      throw new HttpError(403, "MEMBER_ADD_FORBIDDEN", ERROR_MESSAGES.MEMBER_ADD_FORBIDDEN);
    }

    const [targetUser] = await tx
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));

    if (!targetUser) {
      throw new HttpError(404, "USER_NOT_FOUND", ERROR_MESSAGES.USER_NOT_FOUND);
    }

    const [existingMembership] = await tx
      .select({ id: workspaceMemberships.id })
      .from(workspaceMemberships)
      .where(
        and(
          eq(workspaceMemberships.workspaceId, workspaceId),
          eq(workspaceMemberships.userId, userId),
        ),
      );

    if (existingMembership) {
      throw new HttpError(409, "MEMBER_ALREADY_EXISTS", ERROR_MESSAGES.MEMBER_ALREADY_EXISTS);
    }

    try {
      const [membership] = await tx
        .insert(workspaceMemberships)
        .values({ workspaceId, userId, role: "member" })
        .returning({ role: workspaceMemberships.role, joinedAt: workspaceMemberships.createdAt });

      if (!membership) {
        throw new Error("Member insert returned no row");
      }

      return {
        userId: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        ...membership,
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpError(409, "MEMBER_ALREADY_EXISTS", ERROR_MESSAGES.MEMBER_ALREADY_EXISTS);
      }

      throw error;
    }
  });
}

export async function listMembers({
  workspaceId,
  requesterId,
  search,
  page,
  limit,
}: ListMembersInput): Promise<ListMembersResult> {
  const [requesterMembership] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, requesterId),
      ),
    );

  if (!requesterMembership) {
    throw new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
  }

  const pattern = search ? buildContainsSearchPattern(search) : undefined;
  const whereCondition = and(
    eq(workspaceMemberships.workspaceId, workspaceId),
    pattern ? or(ilike(users.name, pattern), ilike(users.email, pattern)) : undefined,
  );
  const ownerFirst = sql<number>`case when ${workspaceMemberships.role} = 'owner' then 0 else 1 end`;

  const [countRows, memberRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(whereCondition),
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: workspaceMemberships.role,
        joinedAt: workspaceMemberships.createdAt,
      })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(whereCondition)
      .orderBy(ownerFirst, asc(workspaceMemberships.createdAt), asc(users.id))
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  const total = Number(countRows[0]?.total ?? 0);

  return {
    members: memberRows,
    pagination: createPaginationMeta({ page, limit, total }),
  };
}
