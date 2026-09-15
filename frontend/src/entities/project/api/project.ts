import { axiosInstance } from '@/shared/api'
import type { Pagination } from '@/shared/types/pagination'

export type ProjectCreator = {
  id: string
  name: string
}

export type Project = {
  id: string
  workspaceId: string
  name: string
  description: string | null
  creatorId: string
  creator: ProjectCreator
  createdAt: string
  updatedAt: string
}

export type ProjectMutationProject = Omit<Project, 'creator'>

export type ProjectPagination = Pagination

export type ProjectListParams = {
  page: number
  limit: number
  search?: string
}

export type ListProjectsResponse = {
  projects: Project[]
  pagination: ProjectPagination
}

export type CreateProjectInput = {
  name: string
  description: string | null
}

export type UpdateProjectInput = {
  name?: string
  description?: string | null
}

function authorization(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` }
}

export async function listProjectsRequest(
  workspaceId: string,
  params: ProjectListParams,
  accessToken: string,
): Promise<ListProjectsResponse> {
  const search = params.search?.trim()
  const queryParams = {
    page: params.page,
    limit: params.limit,
    ...(search ? { search } : {}),
  }
  const { data } = await axiosInstance.get<ListProjectsResponse>(
    `/workspaces/${workspaceId}/projects`,
    { params: queryParams, headers: authorization(accessToken) },
  )

  return data
}

export async function createProjectRequest(
  workspaceId: string,
  input: CreateProjectInput,
  accessToken: string,
): Promise<ProjectMutationProject> {
  const { data } = await axiosInstance.post<{
    project: ProjectMutationProject
  }>(`/workspaces/${workspaceId}/projects`, input, {
    headers: authorization(accessToken),
  })

  return data.project
}

export async function getProjectRequest(
  workspaceId: string,
  projectId: string,
  accessToken: string,
): Promise<Project> {
  const { data } = await axiosInstance.get<{ project: Project }>(
    `/workspaces/${workspaceId}/projects/${projectId}`,
    { headers: authorization(accessToken) },
  )

  return data.project
}

export async function updateProjectRequest(
  workspaceId: string,
  projectId: string,
  input: UpdateProjectInput,
  accessToken: string,
): Promise<ProjectMutationProject> {
  const { data } = await axiosInstance.patch<{
    project: ProjectMutationProject
  }>(`/workspaces/${workspaceId}/projects/${projectId}`, input, {
    headers: authorization(accessToken),
  })

  return data.project
}

export async function deleteProjectRequest(
  workspaceId: string,
  projectId: string,
  accessToken: string,
): Promise<void> {
  await axiosInstance.delete(
    `/workspaces/${workspaceId}/projects/${projectId}`,
    { headers: authorization(accessToken) },
  )
}
