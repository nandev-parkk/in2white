import { axiosInstance } from '@/shared/api'
import type { Pagination } from '@/shared/types/pagination'
import type { ResourceStatusFilter } from '@/shared/types/resource-status'

/*
 * 어드민은 프로젝트를 만들거나 이름을 바꾸지 않는다. 내용은 사용자의 것이고, 어드민이 할
 * 일은 신고된 프로젝트를 감추고(소프트 삭제) 실수로 지워진 것을 되살리는 것이다 — 그래서
 * 생성·수정 요청 함수가 없다.
 */

export type AdminProjectWorkspace = {
  id: string
  name: string
}

export type AdminProjectCreator = {
  id: string
  name: string
  email: string
}

export type AdminProject = {
  id: string
  name: string
  description: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  workspace: AdminProjectWorkspace
  creator: AdminProjectCreator
}

export type AdminProjectListItem = AdminProject & {
  /** 제품에 보이는 문서만 센다. 개별 삭제된 문서는 복구 전까지 빠진다. */
  whiteboardDocumentCount: number
}

export type AdminProjectDocument = {
  id: string
  name: string
  creator: { id: string; name: string }
  deletedAt: string | null
  createdAt: string
  updatedAt: string
}

export type AdminProjectDetail = {
  project: AdminProject
  whiteboardDocuments: AdminProjectDocument[]
}

export type ProjectListParams = {
  page: number
  limit: number
  search?: string
  status: ResourceStatusFilter
  workspaceId?: string
}

export type ListProjectsResponse = {
  projects: AdminProjectListItem[]
  pagination: Pagination
}

export async function listProjectsRequest(
  params: ProjectListParams,
): Promise<ListProjectsResponse> {
  const search = params.search?.trim()
  const { data } = await axiosInstance.get<ListProjectsResponse>('/projects', {
    params: {
      page: params.page,
      limit: params.limit,
      status: params.status,
      ...(search ? { search } : {}),
      ...(params.workspaceId ? { workspaceId: params.workspaceId } : {}),
    },
  })

  return data
}

export async function getProjectRequest(
  projectId: string,
): Promise<AdminProjectDetail> {
  const { data } = await axiosInstance.get<AdminProjectDetail>(
    `/projects/${projectId}`,
  )

  return data
}

export async function deleteProjectRequest(projectId: string): Promise<void> {
  await axiosInstance.delete(`/projects/${projectId}`)
}

/* 복구도 상태를 바꾸는 요청이라 POST다. 링크 프리페치로 삭제가 풀리면 안 된다. */
export async function restoreProjectRequest(
  projectId: string,
): Promise<AdminProject> {
  const { data } = await axiosInstance.post<{ project: AdminProject }>(
    `/projects/${projectId}/restore`,
  )

  return data.project
}
