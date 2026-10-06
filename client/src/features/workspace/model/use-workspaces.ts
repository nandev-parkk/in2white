import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createWorkspaceRequest,
  deleteWorkspaceRequest,
  listWorkspacesRequest,
  updateWorkspaceRequest,
} from '@/entities/workspace'

export function useWorkspaces(
  accessToken: string | null,
  userId: string | null,
) {
  return useQuery({
    queryKey: ['workspaces', userId],
    queryFn: () => listWorkspacesRequest(accessToken as string),
    enabled: Boolean(accessToken),
  })
}

export function useCreateWorkspace(accessToken: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) =>
      createWorkspaceRequest(name, accessToken as string),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export function useUpdateWorkspace(accessToken: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      name,
    }: {
      workspaceId: string
      name: string
    }) => updateWorkspaceRequest(workspaceId, name, accessToken as string),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}

export function useDeleteWorkspace(accessToken: string | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workspaceId: string) =>
      deleteWorkspaceRequest(workspaceId, accessToken as string),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
  })
}
