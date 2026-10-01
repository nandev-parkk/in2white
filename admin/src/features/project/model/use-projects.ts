import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  deleteProjectRequest,
  getProjectRequest,
  listProjectsRequest,
  restoreProjectRequest,
  type ProjectListParams,
} from '@/entities/project'
import { QUERY_KEYS } from '@/shared/api'
import { apiErrorCode } from '@/shared/lib/api-error'

export function isProjectNotFound(error: unknown) {
  return apiErrorCode(error) === 'PROJECT_NOT_FOUND'
}

export function useProjects(params: ProjectListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.projects, params],
    queryFn: () => listProjectsRequest(params),
    /* 검색·필터·페이지 전환에서 표가 비었다 다시 차는 깜빡임을 막는다. */
    placeholderData: (previousData) => previousData,
  })
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.project(projectId),
    queryFn: () => getProjectRequest(projectId),
  })
}

/*
 * 대상을 훅 인자가 아니라 mutate 변수로 받는다. 목록에서는 어느 행이 눌렸는지가
 * 그때그때 달라지는데, 훅은 행마다 부를 수 없다.
 *
 * 삭제·복구는 프로젝트 목록과 상세, 워크스페이스 상세의 프로젝트 수까지 바꾼다. 소프트
 * 삭제라 상세 화면에 머문 채 복구할 수 있어야 하므로 상세 키도 함께 비운다 — 하드 삭제인
 * 워크스페이스와 다른 점이다.
 */
function useProjectMutation<TData>(
  request: (projectId: string) => Promise<TData>,
) {
  const queryClient = useQueryClient()

  return useMutation({
    /* 요청 함수를 그대로 넘기지 않는다. TanStack Query가 두 번째 인자로 컨텍스트를 함께
     * 넘겨서 요청 함수의 선택 인자 자리에 엉뚱한 값이 들어간다. */
    mutationFn: (projectId: string) => request(projectId),
    onSuccess: async (_data, projectId) => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects })
      await queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.project(projectId),
      })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workspaces })
    },
  })
}

export function useDeleteProject() {
  return useProjectMutation(deleteProjectRequest)
}

export function useRestoreProject() {
  return useProjectMutation(restoreProjectRequest)
}
