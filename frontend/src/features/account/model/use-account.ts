import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

import {
  changeAccountPasswordRequest,
  getAccountRequest,
  updateAccountRequest,
  type ChangeAccountPasswordInput,
  type UpdateAccountInput,
} from '@/entities/account'
import { useSessionStore } from '@/entities/session'
import { MESSAGES } from '@/shared/constants/messages'

export function accountQueryKey(userId: string): readonly ['account', string] {
  return ['account', userId]
}

function requireAccessToken(accessToken: string | null): string {
  if (!accessToken) {
    throw new Error('Access token is required')
  }

  return accessToken
}

type AccountMutationContext = {
  accessToken: string
  userId: string | null
}

async function captureMutationContext(
  queryClient: ReturnType<typeof useQueryClient>,
  accessToken: string | null,
  userId: string | null,
): Promise<AccountMutationContext> {
  const mutationAccessToken = requireAccessToken(accessToken)

  if (userId) {
    await queryClient.cancelQueries({ queryKey: accountQueryKey(userId) })
  }

  return { accessToken: mutationAccessToken, userId }
}

function isCurrentSession(context: AccountMutationContext): boolean {
  const session = useSessionStore.getState()
  return (
    session.accessToken === context.accessToken &&
    session.user?.id === context.userId
  )
}

export function useAccount(accessToken: string | null, userId: string | null) {
  return useQuery({
    queryKey: userId ? accountQueryKey(userId) : ['account', 'disabled'],
    queryFn: ({ signal }) =>
      getAccountRequest(requireAccessToken(accessToken), signal),
    enabled: Boolean(accessToken && userId),
  })
}

export function useUpdateAccount(
  accessToken: string | null,
  userId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateAccountInput) =>
      updateAccountRequest(input, requireAccessToken(accessToken)),
    onMutate: () => captureMutationContext(queryClient, accessToken, userId),
    onSuccess: (user, _input, context) => {
      if (!context || !isCurrentSession(context)) return

      useSessionStore.getState().setSession(context.accessToken, user)
      if (context.userId) {
        queryClient.setQueryData(accountQueryKey(context.userId), user)
      }
    },
  })
}

export function useChangeAccountPassword(
  accessToken: string | null,
  userId: string | null,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ChangeAccountPasswordInput) =>
      changeAccountPasswordRequest(input, requireAccessToken(accessToken)),
    onMutate: () => captureMutationContext(queryClient, accessToken, userId),
    onSuccess: (result, _input, context) => {
      if (!context || !isCurrentSession(context)) return

      useSessionStore.getState().setSession(result.accessToken, result.user)
      if (context.userId) {
        queryClient.setQueryData(accountQueryKey(context.userId), result.user)
      }
    },
  })
}

export function getAccountApiError(error: unknown): {
  code?: string
  message: string
} {
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as
      { error?: { code?: string; message?: string } } | undefined
    const apiError = data?.error

    if (apiError?.message) {
      return { code: apiError.code, message: apiError.message }
    }
  }

  return { code: 'NETWORK_ERROR', message: MESSAGES.NETWORK_ERROR }
}
