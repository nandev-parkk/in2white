import { axiosInstance } from '@/shared/api'
import type { Pagination } from '@/shared/types/pagination'
import type { ResourceStatusFilter } from '@/shared/types/resource-status'

/*
 * 프로젝트와 같다 — 조회와 소프트 삭제·복구만 있다. 문서 내용은 받지 않는다. 어드민이
 * 사용자의 그림을 들여다볼 이유가 없고, 삭제·복구는 메타데이터만으로 충분하다.
 */

export type AdminWhiteboardDocumentProject = {
  id: string
  name: string
  /** 프로젝트가 삭제돼 있으면 문서를 복구해도 제품에서는 보이지 않는다. */
  deletedAt: string | null
}

export type AdminWhiteboardDocument = {
  id: string
  name: string
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  project: AdminWhiteboardDocumentProject
  workspace: { id: string; name: string }
  creator: { id: string; name: string; email: string }
}

export type WhiteboardDocumentListParams = {
  page: number
  limit: number
  search?: string
  status: ResourceStatusFilter
  projectId?: string
}

export type ListWhiteboardDocumentsResponse = {
  whiteboardDocuments: AdminWhiteboardDocument[]
  pagination: Pagination
}

export async function listWhiteboardDocumentsRequest(
  params: WhiteboardDocumentListParams,
): Promise<ListWhiteboardDocumentsResponse> {
  const search = params.search?.trim()
  const { data } = await axiosInstance.get<ListWhiteboardDocumentsResponse>(
    '/whiteboard-documents',
    {
      params: {
        page: params.page,
        limit: params.limit,
        status: params.status,
        ...(search ? { search } : {}),
        ...(params.projectId ? { projectId: params.projectId } : {}),
      },
    },
  )

  return data
}

export async function deleteWhiteboardDocumentRequest(
  documentId: string,
): Promise<void> {
  await axiosInstance.delete(`/whiteboard-documents/${documentId}`)
}

export async function restoreWhiteboardDocumentRequest(
  documentId: string,
): Promise<AdminWhiteboardDocument> {
  const { data } = await axiosInstance.post<{
    whiteboardDocument: AdminWhiteboardDocument
  }>(`/whiteboard-documents/${documentId}/restore`)

  return data.whiteboardDocument
}
