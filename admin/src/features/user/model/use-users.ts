import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createUserRequest,
  deactivateUserRequest,
  deleteUserRequest,
  getUserDeletionImpactRequest,
  getUserRequest,
  listUsersRequest,
  reactivateUserRequest,
  resetUserPasswordRequest,
  revokeUserSessionsRequest,
  updateUserRequest,
  type CreateUserInput,
  type UpdateUserInput,
  type UserListParams,
} from '@/entities/user'
import { QUERY_KEYS } from '@/shared/api'
import { apiErrorCode } from '@/shared/lib/api-error'

export function isUserNotFound(error: unknown) {
  return apiErrorCode(error) === 'USER_NOT_FOUND'
}

export function useUsers(params: UserListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.users, params],
    queryFn: () => listUsersRequest(params),
    /* 검색·페이지 전환에서 표가 비었다 다시 차는 깜빡임을 막는다. */
    placeholderData: (previousData) => previousData,
  })
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.user(userId),
    queryFn: () => getUserRequest(userId),
  })
}

/* 모달을 열 때만 조회한다. 목록 화면에서 미리 부르면 쓰지 않는 집계 질의가 쌓인다. */
export function useUserDeletionImpact(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.userDeletionImpact(userId),
    queryFn: () => getUserDeletionImpactRequest(userId),
    enabled,
  })
}

function useUserMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  userId?: string,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users })
      if (userId) {
        await queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.user(userId),
        })
      }
    },
  })
}

export function useCreateUser() {
  return useUserMutation((input: CreateUserInput) => createUserRequest(input))
}

export function useUpdateUser(userId: string) {
  return useUserMutation(
    (input: UpdateUserInput) => updateUserRequest(userId, input),
    userId,
  )
}

export function useResetUserPassword(userId: string) {
  return useUserMutation(
    (newPassword: string) => resetUserPasswordRequest(userId, newPassword),
    userId,
  )
}

export function useDeactivateUser(userId: string) {
  return useUserMutation(() => deactivateUserRequest(userId), userId)
}

export function useReactivateUser(userId: string) {
  return useUserMutation(() => reactivateUserRequest(userId), userId)
}

export function useRevokeUserSessions(userId: string) {
  return useUserMutation(() => revokeUserSessionsRequest(userId), userId)
}

export function useDeleteUser(userId: string) {
  return useUserMutation(
    (confirmationEmail: string) => deleteUserRequest(userId, confirmationEmail),
    userId,
  )
}
