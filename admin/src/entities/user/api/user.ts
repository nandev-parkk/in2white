import { axiosInstance } from '@/shared/api'
import type { Pagination } from '@/shared/types/pagination'
import type { WorkspaceRole } from '@/shared/types/workspace-role'

/*
 * 토큰은 `configureAuthInterceptors`가 붙인다. 호출부마다 accessToken을 넘기지 않는
 * 대신, 인터셉터가 설정되지 않은 환경에서는 어떤 요청도 인증되지 않는다.
 */

export type UserStatusFilter = 'all' | 'active' | 'deactivated'

export type AdminUser = {
  id: string
  name: string
  email: string
  deactivatedAt: string | null
  createdAt: string
}

export type AdminUserListItem = AdminUser & {
  workspaceCount: number
}

export type UserListParams = {
  page: number
  limit: number
  search?: string
  status: UserStatusFilter
}

export type ListUsersResponse = {
  users: AdminUserListItem[]
  pagination: Pagination
}

export type AdminUserWorkspace = {
  id: string
  name: string
  isDefault: boolean
  role: WorkspaceRole
  joinedAt: string
}

export type AdminUserDetail = {
  user: AdminUser
  workspaces: AdminUserWorkspace[]
  createdProjectCount: number
  createdWhiteboardDocumentCount: number
}

export type UserDeletionImpact = {
  user: AdminUser
  impact: {
    ownedWorkspaceCount: number
    otherWorkspaceMembershipCount: number
    projectCount: number
    whiteboardDocumentCount: number
  }
}

export type CreateUserInput = {
  email: string
  name: string
  password: string
}

export type UpdateUserInput = {
  name?: string
  email?: string
}

export async function listUsersRequest(
  params: UserListParams,
): Promise<ListUsersResponse> {
  const search = params.search?.trim()
  const { data } = await axiosInstance.get<ListUsersResponse>('/users', {
    params: {
      page: params.page,
      limit: params.limit,
      status: params.status,
      ...(search ? { search } : {}),
    },
  })

  return data
}

export async function getUserRequest(userId: string): Promise<AdminUserDetail> {
  const { data } = await axiosInstance.get<AdminUserDetail>(`/users/${userId}`)

  return data
}

export async function createUserRequest(
  input: CreateUserInput,
): Promise<AdminUser> {
  const { data } = await axiosInstance.post<{ user: AdminUser }>(
    '/users',
    input,
  )

  return data.user
}

export async function updateUserRequest(
  userId: string,
  input: UpdateUserInput,
): Promise<AdminUser> {
  const { data } = await axiosInstance.patch<{ user: AdminUser }>(
    `/users/${userId}`,
    input,
  )

  return data.user
}

export async function resetUserPasswordRequest(
  userId: string,
  newPassword: string,
): Promise<AdminUser> {
  const { data } = await axiosInstance.post<{ user: AdminUser }>(
    `/users/${userId}/password`,
    { newPassword },
  )

  return data.user
}

export async function deactivateUserRequest(
  userId: string,
): Promise<AdminUser> {
  const { data } = await axiosInstance.post<{ user: AdminUser }>(
    `/users/${userId}/deactivate`,
  )

  return data.user
}

export async function reactivateUserRequest(
  userId: string,
): Promise<AdminUser> {
  const { data } = await axiosInstance.post<{ user: AdminUser }>(
    `/users/${userId}/reactivate`,
  )

  return data.user
}

export async function revokeUserSessionsRequest(
  userId: string,
): Promise<AdminUser> {
  const { data } = await axiosInstance.post<{ user: AdminUser }>(
    `/users/${userId}/sessions/revoke`,
  )

  return data.user
}

export async function getUserDeletionImpactRequest(
  userId: string,
): Promise<UserDeletionImpact> {
  const { data } = await axiosInstance.get<UserDeletionImpact>(
    `/users/${userId}/deletion-impact`,
  )

  return data
}

/* 확인용 이메일은 본문으로 보낸다 — 백엔드도 대상과 대조한 뒤에만 삭제한다. */
export async function deleteUserRequest(
  userId: string,
  confirmationEmail: string,
): Promise<void> {
  await axiosInstance.delete(`/users/${userId}`, {
    data: { email: confirmationEmail },
  })
}
