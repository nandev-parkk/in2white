import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changeAccountPasswordRequest,
  getAccountRequest,
  updateAccountRequest,
  type AccountUser,
} from '@/entities/account'
import { useSessionStore } from '@/entities/session'
import { MESSAGES } from '@/shared/constants/messages'

import {
  getAccountApiError,
  useAccount,
  useChangeAccountPassword,
  useUpdateAccount,
} from './use-account'

vi.mock('@/entities/account', () => ({
  changeAccountPasswordRequest: vi.fn(),
  getAccountRequest: vi.fn(),
  updateAccountRequest: vi.fn(),
}))

const accountUser: AccountUser = {
  id: 'user-1',
  name: '기존 이름',
  email: 'user@example.com',
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function createQueryClientWrapper(queryClient: QueryClient) {
  return function QueryClientWrapper({ children }: React.PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('account query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionStore.getState().clearSession()
  })

  it('token과 userId가 있을 때만 계정 query를 실행한다', async () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)
    const queryClient = createTestQueryClient()

    const { result } = renderHook(() => useAccount('token-1', 'user-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    })

    await waitFor(() => expect(result.current.data).toEqual(accountUser))
    expect(getAccountRequest).toHaveBeenCalledWith(
      'token-1',
      expect.any(AbortSignal),
    )
  })

  it('token이나 userId가 없으면 계정 query를 실행하지 않는다', () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(() => useAccount(null, null), {
      wrapper: createQueryClientWrapper(queryClient),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(getAccountRequest).not.toHaveBeenCalled()
    expect(queryClient.getQueryCache().getAll()[0]?.queryKey).toEqual([
      'account',
      'disabled',
    ])
  })

  it('이름 변경 성공 시 account query cache를 갱신한다', async () => {
    const updatedUser = { ...accountUser, name: '새 이름' }
    vi.mocked(updateAccountRequest).mockResolvedValue(updatedUser)
    useSessionStore.getState().setSession('token-1', accountUser)
    const queryClient = createTestQueryClient()

    const { result } = renderHook(() => useUpdateAccount('token-1', 'user-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    })

    await act(async () => {
      await result.current.mutateAsync({ name: '새 이름' })
    })

    expect(queryClient.getQueryData(['account', 'user-1'])).toEqual(updatedUser)
    expect(useSessionStore.getState()).toMatchObject({
      accessToken: 'token-1',
      user: updatedUser,
    })
  })

  it('비밀번호 변경 결과로 새 access token과 user를 반환한다', async () => {
    useSessionStore.getState().setSession('token-1', accountUser)
    const resultData = { accessToken: 'token-2', user: accountUser }
    vi.mocked(changeAccountPasswordRequest).mockResolvedValue(resultData)
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useChangeAccountPassword('token-1', 'user-1'),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await expect(
      result.current.mutateAsync({
        currentPassword: 'Old123!',
        newPassword: 'New12345!',
      }),
    ).resolves.toEqual(resultData)
    expect(queryClient.getQueryData(['account', 'user-1'])).toEqual(accountUser)
    expect(useSessionStore.getState()).toMatchObject(resultData)
  })

  it.each(['이름', '비밀번호'] as const)(
    '진행 중인 오래된 계정 query가 %s 변경 성공 결과를 덮어쓰지 않는다',
    async (kind) => {
      let resolveAccount!: (user: AccountUser) => void
      const staleUser = { ...accountUser, name: '오래된 이름' }
      const updatedUser = { ...accountUser, name: '새 이름' }
      vi.mocked(getAccountRequest).mockImplementation(
        () =>
          new Promise<AccountUser>((resolve) => {
            resolveAccount = resolve
          }),
      )
      vi.mocked(updateAccountRequest).mockResolvedValue(updatedUser)
      vi.mocked(changeAccountPasswordRequest).mockResolvedValue({
        accessToken: 'token-2',
        user: updatedUser,
      })
      useSessionStore.getState().setSession('token-1', accountUser)
      const queryClient = createTestQueryClient()
      const { result } = renderHook(
        () => ({
          account: useAccount('token-1', 'user-1'),
          update: useUpdateAccount('token-1', 'user-1'),
          password: useChangeAccountPassword('token-1', 'user-1'),
        }),
        { wrapper: createQueryClientWrapper(queryClient) },
      )

      await waitFor(() => expect(getAccountRequest).toHaveBeenCalled())
      if (kind === '이름') {
        await act(async () => {
          await result.current.update.mutateAsync({ name: '새 이름' })
        })
      } else {
        await act(async () => {
          await result.current.password.mutateAsync({
            currentPassword: 'Old123!',
            newPassword: 'New12345!',
          })
        })
      }

      expect(queryClient.getQueryData(['account', 'user-1'])).toEqual(
        updatedUser,
      )

      await act(async () => {
        resolveAccount(staleUser)
        await Promise.resolve()
      })

      expect(queryClient.getQueryData(['account', 'user-1'])).toEqual(
        updatedUser,
      )
    },
  )

  describe.each(['이름', '비밀번호'] as const)(
    '%s mutation 세션 경합',
    (kind) => {
      it.each(['logout', '새 token', '다른 사용자'] as const)(
        '%s 이후 도착한 응답은 session과 cache를 덮지 않는다',
        async (transition) => {
          const updatedUser = { ...accountUser, name: '늦은 응답' }
          let finish!: () => void
          vi.mocked(updateAccountRequest).mockImplementation(
            () =>
              new Promise((resolve) => {
                finish = () => resolve(updatedUser)
              }),
          )
          vi.mocked(changeAccountPasswordRequest).mockImplementation(
            () =>
              new Promise((resolve) => {
                finish = () =>
                  resolve({ accessToken: 'late-token', user: updatedUser })
              }),
          )
          useSessionStore.getState().setSession('token-1', accountUser)
          const queryClient = createTestQueryClient()
          queryClient.setQueryData(['account', 'user-1'], accountUser)
          const { result, rerender } = renderHook(
            ({ token, id }) => {
              const name = useUpdateAccount(token, id)
              const password = useChangeAccountPassword(token, id)
              return () =>
                kind === '이름'
                  ? name.mutateAsync({ name: '늦은 응답' })
                  : password.mutateAsync({
                      currentPassword: 'Old123!',
                      newPassword: 'New12345!',
                    })
            },
            {
              initialProps: {
                token: 'token-1' as string | null,
                id: 'user-1' as string | null,
              },
              wrapper: createQueryClientWrapper(queryClient),
            },
          )
          let pending!: Promise<unknown>
          act(() => {
            pending = result.current()
          })
          await waitFor(() => expect(finish).toBeTypeOf('function'))
          const nextUser = {
            ...accountUser,
            id: transition === '다른 사용자' ? 'user-2' : 'user-1',
            name: '새 세션 사용자',
          }
          act(() => {
            if (transition === 'logout')
              useSessionStore.getState().clearSession()
            else {
              useSessionStore.getState().setSession('new-token', nextUser)
              queryClient.setQueryData(['account', nextUser.id], nextUser)
            }
          })
          rerender({
            token: transition === 'logout' ? null : 'new-token',
            id: transition === 'logout' ? null : nextUser.id,
          })
          await act(async () => {
            finish()
            await pending
          })
          expect(useSessionStore.getState()).toMatchObject({
            accessToken: transition === 'logout' ? null : 'new-token',
            user: transition === 'logout' ? null : nextUser,
          })
          expect(queryClient.getQueryData(['account', 'user-1'])).toEqual(
            transition === '새 token' ? nextUser : accountUser,
          )
          if (transition === '다른 사용자')
            expect(queryClient.getQueryData(['account', 'user-2'])).toEqual(
              nextUser,
            )
        },
      )
    },
  )

  it('access token 없이 이름 변경 요청을 실행하지 않는다', async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useUpdateAccount(null, 'user-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    })

    await expect(
      result.current.mutateAsync({ name: '새 이름' }),
    ).rejects.toThrow('Access token is required')
    expect(updateAccountRequest).not.toHaveBeenCalled()
  })

  it('access token 없이 비밀번호 변경 요청을 실행하지 않는다', async () => {
    const queryClient = createTestQueryClient()
    const { result } = renderHook(
      () => useChangeAccountPassword(null, 'user-1'),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await expect(
      result.current.mutateAsync({
        currentPassword: 'Old123!',
        newPassword: 'New12345!',
      }),
    ).rejects.toThrow('Access token is required')
    expect(changeAccountPasswordRequest).not.toHaveBeenCalled()
  })

  it('Axios 계정 API 오류의 code와 message를 반환한다', () => {
    expect(
      getAccountApiError({
        isAxiosError: true,
        response: {
          data: {
            error: { code: 'INVALID_PASSWORD', message: '비밀번호가 틀렸어요' },
          },
        },
      }),
    ).toEqual({ code: 'INVALID_PASSWORD', message: '비밀번호가 틀렸어요' })
    expect(getAccountApiError(new Error('network'))).toEqual({
      code: 'NETWORK_ERROR',
      message: MESSAGES.NETWORK_ERROR,
    })
  })
})
