import { axiosInstance } from '@/shared/api'
import type { Pagination } from '@/shared/types/pagination'
import type { WorkspaceRole } from '@/shared/types/workspace-role'

/*
 * 어드민은 워크스페이스를 만들지 않는다. 생성은 제품의 사용자 행위이고, 사용자를 추가할
 * 때 기본 워크스페이스가 함께 생긴다 — 그래서 생성 요청 함수가 없다.
 */

export type AdminWorkspaceOwner = {
  id: string
  name: string
  email: string
}

export type AdminWorkspaceSummary = {
  id: string
  name: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type AdminWorkspaceListItem = AdminWorkspaceSummary & {
  owner: AdminWorkspaceOwner
  memberCount: number
  projectCount: number
}

export type WorkspaceListParams = {
  page: number
  limit: number
  search?: string
}

export type ListWorkspacesResponse = {
  workspaces: AdminWorkspaceListItem[]
  pagination: Pagination
}

export type AdminWorkspaceMember = {
  userId: string
  name: string
  email: string
  deactivatedAt: string | null
  role: WorkspaceRole
  joinedAt: string
}

export type AdminWorkspaceProject = {
  id: string
  name: string
  creator: { id: string; name: string }
  whiteboardDocumentCount: number
  deletedAt: string | null
  createdAt: string
}

export type AdminWorkspaceDetail = {
  workspace: AdminWorkspaceSummary & { owner: AdminWorkspaceOwner }
  members: AdminWorkspaceMember[]
  projects: AdminWorkspaceProject[]
}

export type UpdateWorkspaceInput = {
  name: string
}

export type TransferWorkspaceOwnerResponse = {
  workspace: AdminWorkspaceSummary
  owner: AdminWorkspaceOwner
}

export async function listWorkspacesRequest(
  params: WorkspaceListParams,
): Promise<ListWorkspacesResponse> {
  const search = params.search?.trim()
  const { data } = await axiosInstance.get<ListWorkspacesResponse>(
    '/workspaces',
    {
      params: {
        page: params.page,
        limit: params.limit,
        ...(search ? { search } : {}),
      },
    },
  )

  return data
}

export async function getWorkspaceRequest(
  workspaceId: string,
): Promise<AdminWorkspaceDetail> {
  const { data } = await axiosInstance.get<AdminWorkspaceDetail>(
    `/workspaces/${workspaceId}`,
  )

  return data
}

export async function updateWorkspaceRequest(
  workspaceId: string,
  input: UpdateWorkspaceInput,
): Promise<AdminWorkspaceSummary> {
  const { data } = await axiosInstance.patch<{
    workspace: AdminWorkspaceSummary
  }>(`/workspaces/${workspaceId}`, input)

  return data.workspace
}

/* 상태를 바꾸는 요청이라 POST다. 링크 프리페치로 소유자가 바뀌면 안 된다. */
export async function transferWorkspaceOwnerRequest(
  workspaceId: string,
  userId: string,
): Promise<TransferWorkspaceOwnerResponse> {
  const { data } = await axiosInstance.post<TransferWorkspaceOwnerResponse>(
    `/workspaces/${workspaceId}/transfer-owner`,
    { userId },
  )

  return data
}

export async function addWorkspaceMemberRequest(
  workspaceId: string,
  userId: string,
): Promise<AdminWorkspaceMember> {
  const { data } = await axiosInstance.post<{ member: AdminWorkspaceMember }>(
    `/workspaces/${workspaceId}/members`,
    { userId },
  )

  return data.member
}

export async function removeWorkspaceMemberRequest(
  workspaceId: string,
  userId: string,
): Promise<void> {
  await axiosInstance.delete(`/workspaces/${workspaceId}/members/${userId}`)
}

export async function deleteWorkspaceRequest(
  workspaceId: string,
): Promise<void> {
  await axiosInstance.delete(`/workspaces/${workspaceId}`)
}
