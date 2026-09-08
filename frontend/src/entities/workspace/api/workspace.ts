import { axiosInstance } from '@/shared/api'

export type WorkspaceRole = 'owner' | 'member'

export type WorkspaceSummary = {
  id: string
  name: string
  ownerId: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
  role: WorkspaceRole
}

export type ListWorkspacesResponse = {
  workspaces: WorkspaceSummary[]
}

export type CreateWorkspaceResponse = {
  workspace: Omit<WorkspaceSummary, 'role'>
}

export async function listWorkspacesRequest(
  accessToken: string,
): Promise<WorkspaceSummary[]> {
  const { data } = await axiosInstance.get<ListWorkspacesResponse>(
    '/workspaces',
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  return data.workspaces
}

export async function createWorkspaceRequest(
  name: string,
  accessToken: string,
): Promise<WorkspaceSummary> {
  const { data } = await axiosInstance.post<CreateWorkspaceResponse>(
    '/workspaces',
    { name },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  return {
    ...data.workspace,
    role: 'owner',
  }
}
