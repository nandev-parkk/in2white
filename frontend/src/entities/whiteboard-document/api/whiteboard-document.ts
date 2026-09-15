import { axiosInstance } from '@/shared/api'
import type { Pagination } from '@/shared/types/pagination'

export type WhiteboardDocumentCreator = {
  id: string
  name: string
}

export type WhiteboardDocument = {
  id: string
  projectId: string
  name: string
  creatorId: string
  creator: WhiteboardDocumentCreator
  createdAt: string
  updatedAt: string
}

/** 생성 응답은 creator를 포함하지 않는다. */
export type CreatedWhiteboardDocument = Omit<WhiteboardDocument, 'creator'>

/** 이름 변경 응답은 변경된 필드만 돌려준다. */
export type UpdatedWhiteboardDocument = {
  id: string
  name: string
  updatedAt: string
}

export type WhiteboardDocumentListParams = {
  page: number
  limit: number
  search?: string
}

export type ListWhiteboardDocumentsResponse = {
  whiteboardDocuments: WhiteboardDocument[]
  pagination: Pagination
}

export type WhiteboardDocumentInput = {
  name: string
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

function documentsUrl(workspaceId: string, projectId: string) {
  return `/workspaces/${workspaceId}/projects/${projectId}/whiteboard-documents`
}

export async function listWhiteboardDocumentsRequest(
  workspaceId: string,
  projectId: string,
  params: WhiteboardDocumentListParams,
  accessToken: string,
): Promise<ListWhiteboardDocumentsResponse> {
  const search = params.search?.trim()
  const { data } = await axiosInstance.get<ListWhiteboardDocumentsResponse>(
    documentsUrl(workspaceId, projectId),
    {
      params: {
        page: params.page,
        limit: params.limit,
        ...(search ? { search } : {}),
      },
      headers: authorization(accessToken),
    },
  )

  return data
}

export async function createWhiteboardDocumentRequest(
  workspaceId: string,
  projectId: string,
  input: WhiteboardDocumentInput,
  accessToken: string,
): Promise<CreatedWhiteboardDocument> {
  const { data } = await axiosInstance.post<{
    whiteboardDocument: CreatedWhiteboardDocument
  }>(documentsUrl(workspaceId, projectId), input, {
    headers: authorization(accessToken),
  })

  return data.whiteboardDocument
}

export async function updateWhiteboardDocumentRequest(
  workspaceId: string,
  projectId: string,
  documentId: string,
  input: WhiteboardDocumentInput,
  accessToken: string,
): Promise<UpdatedWhiteboardDocument> {
  const { data } = await axiosInstance.patch<{
    whiteboardDocument: UpdatedWhiteboardDocument
  }>(`${documentsUrl(workspaceId, projectId)}/${documentId}`, input, {
    headers: authorization(accessToken),
  })

  return data.whiteboardDocument
}

export async function deleteWhiteboardDocumentRequest(
  workspaceId: string,
  projectId: string,
  documentId: string,
  accessToken: string,
): Promise<void> {
  await axiosInstance.delete(
    `${documentsUrl(workspaceId, projectId)}/${documentId}`,
    { headers: authorization(accessToken) },
  )
}
