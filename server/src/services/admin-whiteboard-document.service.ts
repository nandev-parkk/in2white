import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";
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
 * 프로젝트 서비스와 같은 구조다 — 어드민은 문서를 만들거나 이름을 바꾸지 않고, 감추고
 * 되살리기만 한다. 문서 내용(`whiteboard_document_contents`)은 읽지 않는다. 어드민이
 * 사용자의 그림을 들여다볼 이유가 없고, 삭제·복구는 메타데이터만으로 충분하다.
 */

const DOCUMENT_SUMMARY_COLUMNS = {
  id: whiteboardDocuments.id,
  name: whiteboardDocuments.name,
  deletedAt: whiteboardDocuments.deletedAt,
  createdAt: whiteboardDocuments.createdAt,
  updatedAt: whiteboardDocuments.updatedAt,
} as const;

/*
 * 프로젝트의 삭제 시각까지 함께 읽는다. 문서는 프로젝트를 경유해 조회되므로 프로젝트가
 * 삭제돼 있으면 문서를 복구해도 제품에서는 보이지 않는다. 화면이 그 사실을 안내해야 한다.
 */
const DOCUMENT_JOIN_COLUMNS = {
  projectId: projects.id,
  projectName: projects.name,
  projectDeletedAt: projects.deletedAt,
  workspaceId: workspaces.id,
  workspaceName: workspaces.name,
  creatorId: users.id,
  creatorName: users.name,
  creatorEmail: users.email,
} as const;

export interface AdminWhiteboardDocumentProject {
  id: string;
  name: string;
  deletedAt: Date | null;
}

export interface AdminWhiteboardDocument {
  id: string;
  name: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: AdminWhiteboardDocumentProject;
  workspace: { id: string; name: string };
  creator: { id: string; name: string; email: string };
}

export interface ListAdminWhiteboardDocumentsInput {
  projectId?: string;
  search?: string;
  status: ResourceStatusFilter;
  page: number;
  limit: number;
}

export interface ListAdminWhiteboardDocumentsResult {
  whiteboardDocuments: AdminWhiteboardDocument[];
  pagination: PaginationMeta;
}

/* join 결과는 평평하게 내려온다. 중첩 객체 조립을 한곳에 두어 세 쿼리가 같은 모양을 낸다. */
interface DocumentFlatRow {
  id: string;
  name: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  projectId: string;
  projectName: string;
  projectDeletedAt: Date | null;
  workspaceId: string;
  workspaceName: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
}

function documentNotFound() {
  return new HttpError(
    404,
    "WHITEBOARD_DOCUMENT_NOT_FOUND",
    ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
  );
}

function resourceNotDeleted() {
  return new HttpError(400, "RESOURCE_NOT_DELETED", ERROR_MESSAGES.RESOURCE_NOT_DELETED);
}

function toDocument({
  projectId,
  projectName,
  projectDeletedAt,
  workspaceId,
  workspaceName,
  creatorId,
  creatorName,
  creatorEmail,
  ...document
}: DocumentFlatRow): AdminWhiteboardDocument {
  return {
    ...document,
    project: { id: projectId, name: projectName, deletedAt: projectDeletedAt },
    workspace: { id: workspaceId, name: workspaceName },
    creator: { id: creatorId, name: creatorName, email: creatorEmail },
  };
}

export async function listWhiteboardDocuments({
  projectId,
  search,
  status,
  page,
  limit,
}: ListAdminWhiteboardDocumentsInput): Promise<ListAdminWhiteboardDocumentsResult> {
  const pattern = search ? buildContainsSearchPattern(search) : undefined;
  /* 문서 이름만으로는 찾기 어렵다 — 프로젝트 이름으로도 좁힌다. */
  const whereCondition = and(
    projectId ? eq(whiteboardDocuments.projectId, projectId) : undefined,
    resourceStatusCondition(status, whiteboardDocuments.deletedAt),
    pattern
      ? or(ilike(whiteboardDocuments.name, pattern), ilike(projects.name, pattern))
      : undefined,
  );

  const [countRows, documentRows] = await Promise.all([
    db
      .select({ total: count() })
      .from(whiteboardDocuments)
      .innerJoin(projects, eq(whiteboardDocuments.projectId, projects.id))
      .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
      .innerJoin(users, eq(whiteboardDocuments.creatorId, users.id))
      .where(whereCondition),
    db
      .select({ ...DOCUMENT_SUMMARY_COLUMNS, ...DOCUMENT_JOIN_COLUMNS })
      .from(whiteboardDocuments)
      .innerJoin(projects, eq(whiteboardDocuments.projectId, projects.id))
      .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
      .innerJoin(users, eq(whiteboardDocuments.creatorId, users.id))
      .where(whereCondition)
      .orderBy(desc(whiteboardDocuments.createdAt), asc(whiteboardDocuments.id))
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  return {
    whiteboardDocuments: documentRows.map(toDocument),
    pagination: createPaginationMeta({ page, limit, total: Number(countRows[0]?.total ?? 0) }),
  };
}

async function findDocumentForChange(tx: TransactionHandle, documentId: string) {
  const [documentRow] = await tx
    .select({ ...DOCUMENT_SUMMARY_COLUMNS, ...DOCUMENT_JOIN_COLUMNS })
    .from(whiteboardDocuments)
    .innerJoin(projects, eq(whiteboardDocuments.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(users, eq(whiteboardDocuments.creatorId, users.id))
    .where(eq(whiteboardDocuments.id, documentId));

  if (!documentRow) {
    throw documentNotFound();
  }

  return toDocument(documentRow);
}

export async function deleteWhiteboardDocument(
  tx: TransactionHandle,
  documentId: string,
): Promise<AdminWhiteboardDocument> {
  const document = await findDocumentForChange(tx, documentId);

  /* 프로젝트 삭제 여부는 보지 않는다 — 프로젝트가 복구되면 이 문서가 다시 보이면 안 된다. */
  if (document.deletedAt !== null) {
    throw documentNotFound();
  }

  const now = new Date();
  const [deleted] = await tx
    .update(whiteboardDocuments)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(whiteboardDocuments.id, documentId), isNull(whiteboardDocuments.deletedAt)))
    .returning({ id: whiteboardDocuments.id });

  // 선행 조회와 update 사이에 문서가 사라진 경우다.
  if (!deleted) {
    throw documentNotFound();
  }

  return { ...document, deletedAt: now, updatedAt: now };
}

/*
 * 프로젝트가 삭제된 문서도 복구한다. 제품에서는 여전히 보이지 않지만, 프로젝트를 먼저
 * 복구할지 문서만 되살려 둘지는 어드민이 판단할 일이다. 반환값의 `project.deletedAt`으로
 * 화면이 "프로젝트도 복구해야 보입니다"를 안내한다.
 */
export async function restoreWhiteboardDocument(
  tx: TransactionHandle,
  documentId: string,
): Promise<AdminWhiteboardDocument> {
  const document = await findDocumentForChange(tx, documentId);

  if (document.deletedAt === null) {
    throw resourceNotDeleted();
  }

  const now = new Date();
  const [restored] = await tx
    .update(whiteboardDocuments)
    .set({ deletedAt: null, updatedAt: now })
    .where(and(eq(whiteboardDocuments.id, documentId), isNotNull(whiteboardDocuments.deletedAt)))
    .returning({ id: whiteboardDocuments.id });

  if (!restored) {
    throw documentNotFound();
  }

  return { ...document, deletedAt: null, updatedAt: now };
}
