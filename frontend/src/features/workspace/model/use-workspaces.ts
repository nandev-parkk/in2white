import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createWorkspaceRequest,
  listWorkspacesRequest,
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
