import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { ERROR_MESSAGES } from "@/constants/messages";
import { db } from "@/db/client";
import { projects, users, whiteboardDocuments, workspaces } from "@/db/schema";
import type { TransactionHandle } from "@/db/transaction";
import type { ResourceStatusFilter } from "@/schemas/admin-resource.schema";
import { HttpError } from "@/utils/http-error";
import type { PaginationMeta } from "@/utils/pagination";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { resourceStatusCondition } from "@/utils/resource-status";
import { buildContainsSearchPattern } from "@/utils/search";

/*
 * 어드민의 프로젝트 조회와 소프트 삭제·복구만 담당한다. 제품 서비스와 달리 요청자의 멤버십도
 * 생성자 여부도 보지 않는다 — 권한은 `authenticateAdmin`이 지킨다.
 *
 * 어드민은 프로젝트를 만들지도, 이름을 바꾸지도 않는다. 내용은 사용자의 것이고 어드민이
 * 할 일은 신고된 프로젝트를 감추고(소프트 삭제) 실수로 지워진 것을 되살리는 것이다.
 * 감사 로그는 컨트롤러가 기록하므로 변경 함수는 트랜잭션 핸들을 인자로 받는다.
 */

const PROJECT_SUMMARY_COLUMNS = {
  id: projects.id,
  name: projects.name,
  description: projects.description,
  deletedAt: projects.deletedAt,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
} as const;

/* 전역 목록이라 소속 워크스페이스와 생성자가 없으면 어느 프로젝트인지 분간할 수 없다. */
const PROJECT_JOIN_COLUMNS = {
  workspaceId: workspaces.id,
  workspaceName: workspaces.name,
  creatorId: users.id,
  creatorName: users.name,
  creatorEmail: users.email,
} as const;

/* 목록의 문서 수는 제품에 보이는 것만 센다 — 개별 삭제된 문서는 복구 전까지 없는 것이다. */
const ACTIVE_DOCUMENT_COUNT = sql<number>`(
  select count(*) from ${whiteboardDocuments}
  where ${whiteboardDocuments.projectId} = ${projects.id} and ${whiteboardDocuments.deletedAt} is null
)`;

export interface AdminProjectWorkspace {
  id: string;
  name: string;
}

export interface AdminProjectCreator {
  id: string;
  name: string;
  email: string;
}

export interface AdminProject {
  id: string;
  name: string;
  description: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workspace: AdminProjectWorkspace;
  creator: AdminProjectCreator;
}

export interface AdminProjectListItem extends AdminProject {
  whiteboardDocumentCount: number;
}

export interface ListAdminProjectsInput {
  workspaceId?: string;
  search?: string;
  status: ResourceStatusFilter;
  page: number;
  limit: number;
}

export interface ListAdminProjectsResult {
  projects: AdminProjectListItem[];
  pagination: PaginationMeta;
}

export interface AdminProjectDocument {
  id: string;
  name: string;
  creator: { id: string; name: string };
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminProjectDetail {
  project: AdminProject;
  whiteboardDocuments: AdminProjectDocument[];
}

/* join 결과는 평평하게 내려온다. 중첩 객체 조립을 한곳에 두어 세 쿼리가 같은 모양을 낸다. */
interface ProjectFlatRow {
  id: string;
  name: string;
  description: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
  workspaceName: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
}

function projectNotFound() {
  return new HttpError(404, "PROJECT_NOT_FOUND", ERROR_MESSAGES.PROJECT_NOT_FOUND);
}

function resourceNotDeleted() {
  return new HttpError(400, "RESOURCE_NOT_DELETED", ERROR_MESSAGES.RESOURCE_NOT_DELETED);
}

function toProject({
  workspaceId,
  workspaceName,
  creatorId,
  creatorName,
  creatorEmail,
  ...project
}: ProjectFlatRow): AdminProject {
  return {
    ...project,
    workspace: { id: workspaceId, name: workspaceName },
    creator: { id: creatorId, name: creatorName, email: creatorEmail },
  };
}

export async function listProjects({
  workspaceId,
  search,
  status,
  page,
  limit,
}: ListAdminProjectsInput): Promise<ListAdminProjectsResult> {
  const pattern = search ? buildContainsSearchPattern(search) : undefined;
  /* 이름뿐 아니라 생성자 이름·이메일로도 찾는다 — 신고는 보통 사용자 단위로 들어온다. */
  const whereCondition = and(
    workspaceId ? eq(projects.workspaceId, workspaceId) : undefined,
    resourceStatusCondition(status, projects.deletedAt),
    pattern
      ? or(ilike(projects.name, pattern), ilike(users.name, pattern), ilike(users.email, pattern))
      : undefined,
  );

  const [countRows, projectRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(projects)
      .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
      .innerJoin(users, eq(projects.creatorId, users.id))
      .where(whereCondition),
    db
      .select({
        ...PROJECT_SUMMARY_COLUMNS,
        ...PROJECT_JOIN_COLUMNS,
        whiteboardDocumentCount: ACTIVE_DOCUMENT_COUNT,
      })
      .from(projects)
      .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
      .innerJoin(users, eq(projects.creatorId, users.id))
      .where(whereCondition)
      .orderBy(desc(projects.createdAt), asc(projects.id))
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  return {
    projects: projectRows.map(({ whiteboardDocumentCount, ...row }) => ({
      ...toProject(row),
      whiteboardDocumentCount: Number(whiteboardDocumentCount),
    })),
    pagination: createPaginationMeta({ page, limit, total: Number(countRows[0]?.total ?? 0) }),
  };
}

export async function getProjectDetail(projectId: string): Promise<AdminProjectDetail> {
  /* 삭제 여부로 좁히지 않는다 — 삭제된 프로젝트의 상세가 복구 판단에 쓰이는 화면이다. */
  const [projectRow] = await db
    .select({ ...PROJECT_SUMMARY_COLUMNS, ...PROJECT_JOIN_COLUMNS })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(users, eq(projects.creatorId, users.id))
    .where(eq(projects.id, projectId));

  if (!projectRow) {
    throw projectNotFound();
  }

  /*
   * 문서도 페이지를 나누지 않는다. 한 프로젝트의 문서는 제품 화면 하나에 들어가는 규모다.
   * 삭제된 문서도 함께 보여준다 — 개별 복구 대상을 여기서만 찾을 수 있다.
   */
  const documentRows = await db
    .select({
      id: whiteboardDocuments.id,
      name: whiteboardDocuments.name,
      creatorId: users.id,
      creatorName: users.name,
      deletedAt: whiteboardDocuments.deletedAt,
      createdAt: whiteboardDocuments.createdAt,
      updatedAt: whiteboardDocuments.updatedAt,
    })
    .from(whiteboardDocuments)
    .innerJoin(users, eq(whiteboardDocuments.creatorId, users.id))
    .where(eq(whiteboardDocuments.projectId, projectId))
    .orderBy(desc(whiteboardDocuments.createdAt), asc(whiteboardDocuments.id));

  return {
    project: toProject(projectRow),
    whiteboardDocuments: documentRows.map(
      ({ creatorId: documentCreatorId, creatorName: documentCreatorName, ...document }) => ({
        ...document,
        creator: { id: documentCreatorId, name: documentCreatorName },
      }),
    ),
  };
}

async function findProjectForChange(tx: TransactionHandle, projectId: string) {
  const [projectRow] = await tx
    .select({ ...PROJECT_SUMMARY_COLUMNS, ...PROJECT_JOIN_COLUMNS })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(users, eq(projects.creatorId, users.id))
    .where(eq(projects.id, projectId));

  if (!projectRow) {
    throw projectNotFound();
  }

  return toProject(projectRow);
}

export async function deleteProject(
  tx: TransactionHandle,
  projectId: string,
): Promise<AdminProject> {
  const project = await findProjectForChange(tx, projectId);

  /*
   * 이미 삭제된 프로젝트는 어드민 화면에도 "삭제됨"으로 보인다. 다시 지울 대상이 없으므로
   * 404다 — 성공으로 처리하면 `deletedAt`이 뒤로 밀려 복구 판단의 기준 시각이 사라진다.
   */
  if (project.deletedAt !== null) {
    throw projectNotFound();
  }

  const now = new Date();
  const [deleted] = await tx
    .update(projects)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .returning({ id: projects.id });

  // 선행 조회와 update 사이에 프로젝트가 사라진 경우다.
  if (!deleted) {
    throw projectNotFound();
  }

  return { ...project, deletedAt: now, updatedAt: now };
}

/*
 * 제품의 `deleteProject`는 `projects.deletedAt`만 설정하고 하위 문서는 건드리지 않는다.
 * 문서는 프로젝트를 경유해 조회되므로 프로젝트가 숨으면 함께 숨는다. 따라서 복구도
 * `projects.deletedAt`만 비우면 된다 — 개별 삭제되지 않았던 문서는 자동으로 다시 보이고,
 * 프로젝트 삭제 전에 개별 삭제된 문서는 삭제 상태로 남는다.
 */
export async function restoreProject(
  tx: TransactionHandle,
  projectId: string,
): Promise<AdminProject> {
  const project = await findProjectForChange(tx, projectId);

  if (project.deletedAt === null) {
    throw resourceNotDeleted();
  }

  const now = new Date();
  const [restored] = await tx
    .update(projects)
    .set({ deletedAt: null, updatedAt: now })
    .where(and(eq(projects.id, projectId), isNotNull(projects.deletedAt)))
    .returning({ id: projects.id });

  if (!restored) {
    throw projectNotFound();
  }

  return { ...project, deletedAt: null, updatedAt: now };
}
