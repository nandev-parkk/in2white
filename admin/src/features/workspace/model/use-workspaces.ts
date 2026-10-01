import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { listUsersRequest } from '@/entities/user'
import {
  addWorkspaceMemberRequest,
  deleteWorkspaceRequest,
  getWorkspaceRequest,
  listWorkspacesRequest,
  removeWorkspaceMemberRequest,
  transferWorkspaceOwnerRequest,
  updateWorkspaceRequest,
  type UpdateWorkspaceInput,
  type WorkspaceListParams,
} from '@/entities/workspace'
import { QUERY_KEYS } from '@/shared/api'
import { apiErrorCode } from '@/shared/lib/api-error'

/* 멤버 후보는 모달 안에서만 쓴다. 한 화면에 담기는 만큼만 받고 나머지는 검색으로 좁힌다. */
const MEMBER_CANDIDATE_LIMIT = 10

export function isWorkspaceNotFound(error: unknown) {
  return apiErrorCode(error) === 'WORKSPACE_NOT_FOUND'
}

export function useWorkspaces(params: WorkspaceListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.workspaces, params],
    queryFn: () => listWorkspacesRequest(params),
    /* 검색·페이지 전환에서 표가 비었다 다시 차는 깜빡임을 막는다. */
    placeholderData: (previousData) => previousData,
  })
}

export function useWorkspace(workspaceId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.workspace(workspaceId),
    queryFn: () => getWorkspaceRequest(workspaceId),
  })
}

/*
 * 멤버 추가 대상은 전역 사용자 목록에서 고른다. 후보 전용 엔드포인트를 두지 않는 이유는
 * 어드민이 정지된 계정도 멤버로 넣을 수 있어 제품의 초대 후보와 조건이 다르기 때문이다.
 */
export function useMemberCandidates(search: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.memberCandidates(search.trim()),
    queryFn: () =>
      listUsersRequest({
        page: 1,
        limit: MEMBER_CANDIDATE_LIMIT,
        search,
        status: 'all',
      }),
    enabled,
    placeholderData: (previousData) => previousData,
  })
}

/*
 * 목록의 멤버·프로젝트 수와 사용자 목록의 워크스페이스 수가 모두 바뀐다. 상세만 새로
 * 받으면 뒤로 돌아갔을 때 옛 숫자가 남는다.
 */
function useWorkspaceMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  workspaceId?: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.workspaces })
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users })
      if (workspaceId) {
        await queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.workspace(workspaceId),
        })
      }
    },
  })
}

export function useUpdateWorkspace(workspaceId: string) {
  return useWorkspaceMutation(
    (input: UpdateWorkspaceInput) => updateWorkspaceRequest(workspaceId, input),
    workspaceId,
  )
}

export function useTransferWorkspaceOwner(workspaceId: string) {
  return useWorkspaceMutation(
    (userId: string) => transferWorkspaceOwnerRequest(workspaceId, userId),
    workspaceId,
  )
}

export function useAddWorkspaceMember(workspaceId: string) {
  return useWorkspaceMutation(
    (userId: string) => addWorkspaceMemberRequest(workspaceId, userId),
    workspaceId,
  )
}

export function useRemoveWorkspaceMember(workspaceId: string) {
  return useWorkspaceMutation(
    (userId: string) => removeWorkspaceMemberRequest(workspaceId, userId),
    workspaceId,
  )
}

/* 상세 키는 일부러 비운다 — 사라진 워크스페이스를 다시 불러 404 화면을 띄울 뿐이다. */
export function useDeleteWorkspace(workspaceId: string) {
  return useWorkspaceMutation(() => deleteWorkspaceRequest(workspaceId))
}
