import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import {
  projects,
  users,
  whiteboardDocuments,
  workspaceMemberships,
  workspaces,
} from "@/db/schema";
import type { TransactionHandle } from "@/db/transaction";
import { HttpError } from "@/utils/http-error";
import type { PaginationMeta } from "@/utils/pagination";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { buildContainsSearchPattern } from "@/utils/search";

/*
 * 어드민의 워크스페이스 조작만 담당한다. 제품 서비스와 달리 요청자의 멤버십을 보지 않는다 —
 * 권한은 `authenticateAdmin`이 지키고, 어드민은 모든 워크스페이스를 본다.
 * 감사 로그는 컨트롤러가 기록하므로 변경 함수는 트랜잭션 핸들을 인자로 받는다.
 *
 * 기본 워크스페이스(`isDefault`)는 어드민도 이름 변경·삭제·멤버 추가를 할 수 없다. 제품의
 * "모든 사용자는 1인용 기본 워크스페이스를 하나 가진다" 불변식을 어드민이 깨면 제품 화면이
 * 빈 상태로 붕괴한다. 기본 워크스페이스는 사용자 하드 삭제 경로에서만 함께 사라진다.
 */

const WORKSPACE_SUMMARY_COLUMNS = {
  id: workspaces.id,
  name: workspaces.name,
  isDefault: workspaces.isDefault,
  createdAt: workspaces.createdAt,
  updatedAt: workspaces.updatedAt,
} as const;

/* 소유자는 `workspaces.ownerId` join으로 함께 읽는다. 목록·상세·삭제 로그가 모두 쓴다. */
const OWNER_COLUMNS = {
  ownerId: users.id,
  ownerName: users.name,
  ownerEmail: users.email,
} as const;

/*
 * 멤버십과 프로젝트를 한 쿼리에 join하면 행이 곱해져 양쪽 수가 모두 틀린다. 워크스페이스
 * 단위로 묶어 세는 상관 서브쿼리로 분리한다.
 */
const MEMBER_COUNT = sql<number>`(
  select count(*) from ${workspaceMemberships}
  where ${workspaceMemberships.workspaceId} = ${workspaces.id}
)`;

/* 목록의 프로젝트 수는 제품에 보이는 것만 센다 — 소프트 삭제된 프로젝트는 복구 전까지 없다. */
const ACTIVE_PROJECT_COUNT = sql<number>`(
  select count(*) from ${projects}
  where ${projects.workspaceId} = ${workspaces.id} and ${projects.deletedAt} is null
)`;

const ACTIVE_DOCUMENT_COUNT = sql<number>`(
  select count(*) from ${whiteboardDocuments}
  where ${whiteboardDocuments.projectId} = ${projects.id} and ${whiteboardDocuments.deletedAt} is null
)`;

const OWNER_FIRST = sql<number>`case when ${workspaceMemberships.role} = 'owner' then 0 else 1 end`;

export interface AdminWorkspaceOwner {
  id: string;
  name: string;
  email: string;
}

export interface AdminWorkspaceSummary {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminWorkspaceListItem extends AdminWorkspaceSummary {
  owner: AdminWorkspaceOwner;
  memberCount: number;
  projectCount: number;
}

export interface ListWorkspacesInput {
  search?: string;
  page: number;
  limit: number;
}

export interface ListWorkspacesResult {
  workspaces: AdminWorkspaceListItem[];
  pagination: PaginationMeta;
}

export interface AdminWorkspaceMember {
  userId: string;
  name: string;
  email: string;
  deactivatedAt: Date | null;
  role: (typeof workspaceMemberships.$inferSelect)["role"];
  joinedAt: Date;
}

export interface AdminWorkspaceProject {
  id: string;
  name: string;
  creator: { id: string; name: string };
  whiteboardDocumentCount: number;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface AdminWorkspaceDetail {
  workspace: AdminWorkspaceSummary & { owner: AdminWorkspaceOwner };
  members: AdminWorkspaceMember[];
  projects: AdminWorkspaceProject[];
}

export interface UpdateWorkspaceFieldsInput {
  workspaceId: string;
  name: string;
}

export interface UpdateWorkspaceResult {
  previousWorkspace: AdminWorkspaceSummary;
  workspace: AdminWorkspaceSummary;
}

export interface WorkspaceMemberTargetInput {
  workspaceId: string;
  userId: string;
}

export interface TransferWorkspaceOwnerResult {
  workspace: AdminWorkspaceSummary;
  previousOwner: AdminWorkspaceOwner;
  newOwner: AdminWorkspaceOwner;
}

export interface WorkspaceMemberResult {
  workspace: AdminWorkspaceSummary;
  member: AdminWorkspaceMember;
}

export type DeletedAdminWorkspace = AdminWorkspaceSummary & { owner: AdminWorkspaceOwner };

function workspaceNotFound() {
  return new HttpError(404, "WORKSPACE_NOT_FOUND", ERROR_MESSAGES.WORKSPACE_NOT_FOUND);
}

function memberNotFound() {
  return new HttpError(404, "MEMBER_NOT_FOUND", ERROR_MESSAGES.MEMBER_NOT_FOUND);
}

function memberAlreadyExists() {
  return new HttpError(409, "MEMBER_ALREADY_EXISTS", ERROR_MESSAGES.MEMBER_ALREADY_EXISTS);
}

interface OwnerColumnRow {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
}

function toOwner(row: OwnerColumnRow): AdminWorkspaceOwner {
  return { id: row.ownerId, name: row.ownerName, email: row.ownerEmail };
}

export async function listWorkspaces({
  search,
  page,
  limit,
}: ListWorkspacesInput): Promise<ListWorkspacesResult> {
  const pattern = search ? buildContainsSearchPattern(search) : undefined;
  /* 이름뿐 아니라 소유자 이름·이메일로도 찾는다 — 신고는 보통 사용자 단위로 들어온다. */
  const whereCondition = pattern
    ? or(ilike(workspaces.name, pattern), ilike(users.name, pattern), ilike(users.email, pattern))
    : undefined;

  const [countRows, workspaceRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(workspaces)
      .innerJoin(users, eq(workspaces.ownerId, users.id))
      .where(whereCondition),
    db
      .select({
        ...WORKSPACE_SUMMARY_COLUMNS,
        ...OWNER_COLUMNS,
        memberCount: MEMBER_COUNT,
        projectCount: ACTIVE_PROJECT_COUNT,
      })
      .from(workspaces)
      .innerJoin(users, eq(workspaces.ownerId, users.id))
      .where(whereCondition)
      .orderBy(desc(workspaces.createdAt), asc(workspaces.id))
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  return {
    workspaces: workspaceRows.map(({ ownerId, ownerName, ownerEmail, ...row }) => ({
      ...row,
      owner: toOwner({ ownerId, ownerName, ownerEmail }),
      memberCount: Number(row.memberCount),
      projectCount: Number(row.projectCount),
    })),
    pagination: createPaginationMeta({ page, limit, total: Number(countRows[0]?.total ?? 0) }),
  };
}

export async function getWorkspaceDetail(workspaceId: string): Promise<AdminWorkspaceDetail> {
  const [workspaceRow] = await db
    .select({ ...WORKSPACE_SUMMARY_COLUMNS, ...OWNER_COLUMNS })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(eq(workspaces.id, workspaceId));

  if (!workspaceRow) {
    throw workspaceNotFound();
  }

  const { ownerId, ownerName, ownerEmail, ...workspace } = workspaceRow;

  const [memberRows, projectRows] = await Promise.all([
    /*
     * 멤버 목록은 페이지를 나누지 않는다. 멤버 추가는 소유자만 하던 작업이라 한 워크스페이스의
     * 멤버 수는 화면 하나에 들어가는 규모다. 수가 커지면 그때 목록 API를 따로 뗀다.
     */
    db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        deactivatedAt: users.deactivatedAt,
        role: workspaceMemberships.role,
        joinedAt: workspaceMemberships.createdAt,
      })
      .from(workspaceMemberships)
      .innerJoin(users, eq(workspaceMemberships.userId, users.id))
      .where(eq(workspaceMemberships.workspaceId, workspaceId))
      .orderBy(OWNER_FIRST, asc(workspaceMemberships.createdAt), asc(users.id)),
    /* 삭제된 프로젝트도 포함한다 — 어드민 화면의 실질적 가치는 복구 대상을 보는 것이다. */
    db
      .select({
        id: projects.id,
        name: projects.name,
        creatorId: users.id,
        creatorName: users.name,
        whiteboardDocumentCount: ACTIVE_DOCUMENT_COUNT,
        deletedAt: projects.deletedAt,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .innerJoin(users, eq(projects.creatorId, users.id))
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(desc(projects.createdAt), asc(projects.id)),
  ]);

  return {
    workspace: { ...workspace, owner: toOwner({ ownerId, ownerName, ownerEmail }) },
    members: memberRows,
    projects: projectRows.map(({ creatorId, creatorName, ...project }) => ({
      ...project,
      creator: { id: creatorId, name: creatorName },
      whiteboardDocumentCount: Number(project.whiteboardDocumentCount),
    })),
  };
}

export async function updateWorkspace(
  tx: TransactionHandle,
  { workspaceId, name }: UpdateWorkspaceFieldsInput,
): Promise<UpdateWorkspaceResult> {
  const [previousWorkspace] = await tx
    .select(WORKSPACE_SUMMARY_COLUMNS)
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!previousWorkspace) {
    throw workspaceNotFound();
  }

  if (previousWorkspace.isDefault) {
    throw new HttpError(
      403,
      "WORKSPACE_DEFAULT_UPDATE_FORBIDDEN",
      ERROR_MESSAGES.WORKSPACE_DEFAULT_UPDATE_FORBIDDEN,
    );
  }

  const [workspace] = await tx
    .update(workspaces)
    .set({ name, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
    .returning(WORKSPACE_SUMMARY_COLUMNS);

  // 선행 조회와 update 사이에 워크스페이스가 사라진 경우다.
  if (!workspace) {
    throw workspaceNotFound();
  }

  return { previousWorkspace, workspace };
}

export async function transferWorkspaceOwner(
  tx: TransactionHandle,
  { workspaceId, userId }: WorkspaceMemberTargetInput,
): Promise<TransferWorkspaceOwnerResult> {
  const [workspaceRow] = await tx
    .select({ ...WORKSPACE_SUMMARY_COLUMNS, ...OWNER_COLUMNS })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(eq(workspaces.id, workspaceId));

  if (!workspaceRow) {
    throw workspaceNotFound();
  }

  /*
   * 대상은 이미 멤버여야 한다. 비멤버에게 소유권을 넘기면 멤버 목록에 없는 소유자가 생겨
   * 멤버십으로 권한을 보는 제품 경로가 전부 막힌다. 기본 워크스페이스는 멤버가 소유자
   * 한 명뿐이라 이 검사만으로 이전이 막힌다 — 별도 분기를 두지 않는다.
   */
  const [targetMembership] = await tx
    .select({
      id: workspaceMemberships.id,
      name: users.name,
      email: users.email,
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
      ),
    );

  if (!targetMembership) {
    throw new HttpError(
      400,
      "TRANSFER_TARGET_NOT_MEMBER",
      ERROR_MESSAGES.TRANSFER_TARGET_NOT_MEMBER,
    );
  }

  /*
   * `workspaces.ownerId`와 `workspace_memberships.role`은 같은 사실의 두 기록이다. 하나만
   * 바뀌면 소유자와 owner 멤버가 어긋나므로 같은 트랜잭션에서 함께 옮긴다. 기존 owner를
   * 먼저 강등하고 대상을 올리므로, 현재 소유자를 그대로 지정한 요청도 owner로 끝난다.
   */
  await tx
    .update(workspaceMemberships)
    .set({ role: "member" })
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.role, "owner"),
      ),
    );

  await tx
    .update(workspaceMemberships)
    .set({ role: "owner" })
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
      ),
    );

  const [workspace] = await tx
    .update(workspaces)
    .set({ ownerId: userId, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
    .returning(WORKSPACE_SUMMARY_COLUMNS);

  if (!workspace) {
    throw workspaceNotFound();
  }

  const { ownerId, ownerName, ownerEmail } = workspaceRow;

  return {
    workspace,
    previousOwner: toOwner({ ownerId, ownerName, ownerEmail }),
    newOwner: { id: userId, name: targetMembership.name, email: targetMembership.email },
  };
}

export async function addWorkspaceMember(
  tx: TransactionHandle,
  { workspaceId, userId }: WorkspaceMemberTargetInput,
): Promise<WorkspaceMemberResult> {
  const [workspace] = await tx
    .select(WORKSPACE_SUMMARY_COLUMNS)
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!workspace) {
    throw workspaceNotFound();
  }

  if (workspace.isDefault) {
    throw new HttpError(
      403,
      "MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN",
      ERROR_MESSAGES.MEMBER_ADD_DEFAULT_WORKSPACE_FORBIDDEN,
    );
  }

  /*
   * 제품의 멤버 추가와 달리 정지된 계정도 허용한다. 어드민은 전역 사용자 목록에서 대상을
   * 고르고, 정지 계정은 로그인 자체가 막혀 있어 멤버십만으로는 아무것도 할 수 없다.
   * 대신 `deactivatedAt`을 함께 돌려줘 화면이 정지 상태를 드러낸다.
   */
  const [user] = await tx
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
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
    throw memberAlreadyExists();
  }

  const [membership] = await tx
    .insert(workspaceMemberships)
    .values({ workspaceId, userId, role: "member" })
    .onConflictDoNothing()
    .returning({ role: workspaceMemberships.role, joinedAt: workspaceMemberships.createdAt });

  // 사전 조회와 insert 사이에 같은 멤버가 들어온 경합. 제약이 막아준 결과도 중복이다.
  if (!membership) {
    throw memberAlreadyExists();
  }

  return {
    workspace,
    member: {
      userId: user.id,
      name: user.name,
      email: user.email,
      deactivatedAt: user.deactivatedAt,
      ...membership,
    },
  };
}

export async function removeWorkspaceMember(
  tx: TransactionHandle,
  { workspaceId, userId }: WorkspaceMemberTargetInput,
): Promise<WorkspaceMemberResult> {
  const [workspace] = await tx
    .select(WORKSPACE_SUMMARY_COLUMNS)
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));

  if (!workspace) {
    throw workspaceNotFound();
  }

  const [member] = await tx
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      deactivatedAt: users.deactivatedAt,
      role: workspaceMemberships.role,
      joinedAt: workspaceMemberships.createdAt,
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(workspaceMemberships.userId, users.id))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
      ),
    );

  if (!member) {
    throw memberNotFound();
  }

  /* 소유자를 빼면 소유자가 멤버 목록에 없는 워크스페이스가 남는다. 소유자 이전이 먼저다. */
  if (member.role === "owner") {
    throw new HttpError(
      403,
      "MEMBER_OWNER_REMOVE_FORBIDDEN",
      ERROR_MESSAGES.MEMBER_OWNER_REMOVE_FORBIDDEN,
    );
  }

  await tx
    .delete(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
      ),
    );

  return { workspace, member };
}

export async function deleteWorkspace(
  tx: TransactionHandle,
  workspaceId: string,
): Promise<DeletedAdminWorkspace> {
  const [workspaceRow] = await tx
    .select({ ...WORKSPACE_SUMMARY_COLUMNS, ...OWNER_COLUMNS })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(eq(workspaces.id, workspaceId));

  if (!workspaceRow) {
    throw workspaceNotFound();
  }

  if (workspaceRow.isDefault) {
    throw new HttpError(
      403,
      "WORKSPACE_DEFAULT_DELETE_FORBIDDEN",
      ERROR_MESSAGES.WORKSPACE_DEFAULT_DELETE_FORBIDDEN,
    );
  }

  /* 멤버십·프로젝트·문서는 FK cascade가 지운다. 순서를 직접 짜면 누락이 생긴다. */
  await tx.delete(workspaces).where(eq(workspaces.id, workspaceId));

  const { ownerId, ownerName, ownerEmail, ...workspace } = workspaceRow;

  return { ...workspace, owner: toOwner({ ownerId, ownerName, ownerEmail }) };
}
