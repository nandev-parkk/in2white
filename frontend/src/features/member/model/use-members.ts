import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  listMembersRequest,
  listMemberCandidatesRequest,
  addMemberRequest,
  removeMemberRequest,
  type MemberListParams,
} from '@/entities/member'

export function memberErrorCode(error: unknown): string | undefined {
  return isAxiosError(error) ? error.response?.data?.error?.code : undefined
}
export function isMemberAccessLost(error: unknown) {
  return memberErrorCode(error) === 'WORKSPACE_NOT_FOUND'
}
export function useMembers(
  token: string | null,
  userId: string,
  workspaceId: string | null,
  params: MemberListParams,
) {
  return useQuery({
    queryKey: ['members', userId, workspaceId, params],
    queryFn: () => listMembersRequest(workspaceId!, params, token!),
    enabled: Boolean(token && userId && workspaceId),
    retry: (count, error) => !isMemberAccessLost(error) && count < 2,
  })
}
export function useMemberCandidates(
  token: string | null,
  userId: string,
  workspaceId: string,
  params: MemberListParams,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['member-candidates', userId, workspaceId, params],
    queryFn: () => listMemberCandidatesRequest(workspaceId, params, token!),
    enabled: Boolean(token && userId && workspaceId && enabled),
    retry: false,
  })
}
function useMemberMutation(
  token: string,
  userId: string,
  workspaceId: string,
  action: 'add' | 'remove',
) {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['members', userId, workspaceId] }),
      client.invalidateQueries({
        queryKey: ['member-candidates', userId, workspaceId],
      }),
    ])
  return useMutation({
    mutationFn: async (targetId: string) => {
      if (action === 'add') await addMemberRequest(workspaceId, targetId, token)
      else await removeMemberRequest(workspaceId, targetId, token)
    },
    onSuccess: refresh,
    onError: async (error) => {
      if (
        isAxiosError(error) &&
        (error.response?.status === 409 || error.response?.status === 404)
      )
        await refresh()
    },
  })
}
export function useAddMember(
  token: string,
  userId: string,
  workspaceId: string,
) {
  return useMemberMutation(token, userId, workspaceId, 'add')
}
export function useRemoveMember(
  token: string,
  userId: string,
  workspaceId: string,
) {
  return useMemberMutation(token, userId, workspaceId, 'remove')
}
