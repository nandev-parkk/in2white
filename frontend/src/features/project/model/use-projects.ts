import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import {
  createProjectRequest,
  deleteProjectRequest,
  getProjectRequest,
  listProjectsRequest,
  updateProjectRequest,
  type CreateProjectInput,
  type ProjectListParams,
  type UpdateProjectInput,
} from '@/entities/project'

export function useProjects(
  accessToken: string | null,
  workspaceId: string | null,
  params: ProjectListParams,
) {
  return useQuery({
    queryKey: ['projects', workspaceId, params],
    queryFn: () =>
      listProjectsRequest(workspaceId as string, params, accessToken as string),
    enabled: Boolean(accessToken && workspaceId),
  })
}

export function projectErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? error.response?.data?.error?.code : undefined
}

export function isProjectNotFound(error: unknown) {
  const code = projectErrorCode(error)
  return code === 'PROJECT_NOT_FOUND' || code === 'WORKSPACE_NOT_FOUND'
}

export function useProject(
  accessToken: string | null,
  workspaceId: string | null,
  projectId: string | null,
) {
  return useQuery({
    queryKey: ['project', workspaceId, projectId],
    queryFn: () =>
      getProjectRequest(
        workspaceId as string,
        projectId as string,
        accessToken as string,
      ),
    enabled: Boolean(accessToken && workspaceId && projectId),
    retry: (count, error) => !isProjectNotFound(error) && count < 2,
  })
}

export function useCreateProject(
  accessToken: string | null,
  workspaceId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      createProjectRequest(workspaceId as string, input, accessToken as string),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  })
}

export function useUpdateProject(
  accessToken: string | null,
  workspaceId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      projectId,
      input,
    }: {
      projectId: string
      input: UpdateProjectInput
    }) =>
      updateProjectRequest(
        workspaceId as string,
        projectId,
        input,
        accessToken as string,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  })
}

export function useDeleteProject(
  accessToken: string | null,
  workspaceId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) =>
      deleteProjectRequest(
        workspaceId as string,
        projectId,
        accessToken as string,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  })
}
