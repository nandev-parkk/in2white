import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { axiosInstance } from '@/shared/api'
import {
  useMembers,
  useMemberCandidates,
  useAddMember,
  useRemoveMember,
} from './use-members'
vi.mock('@/shared/api', () => ({
  axiosInstance: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))
const params = { page: 1, limit: 20 }
function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  return {
    client,
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  }
}
beforeEach(() => vi.clearAllMocks())
it('사용자와 워크스페이스가 바뀌면 이전 멤버 캐시를 표시하지 않는다', async () => {
  vi.mocked(axiosInstance.get)
    .mockResolvedValueOnce({ data: { members: [{ name: '첫 사용자' }] } })
    .mockImplementation(() => new Promise(() => {}))
  const { wrapper } = setup()
  const { result, rerender } = renderHook(
    ({ user, ws }) => useMembers('token', user, ws, params),
    { initialProps: { user: 'u1', ws: 'w1' }, wrapper },
  )
  await waitFor(() =>
    expect(result.current.data?.members[0].name).toBe('첫 사용자'),
  )
  rerender({ user: 'u2', ws: 'w1' })
  expect(result.current.data).toBeUndefined()
  rerender({ user: 'u1', ws: 'w2' })
  expect(result.current.data).toBeUndefined()
})
it('모달이 닫히거나 owner가 아니면 후보 조회를 하지 않는다', () => {
  const { wrapper } = setup()
  const { result } = renderHook(
    () => useMemberCandidates('token', 'u', 'w', params, false),
    { wrapper },
  )
  expect(result.current.fetchStatus).toBe('idle')
  expect(axiosInstance.get).not.toHaveBeenCalled()
})
it.each(['success', 'duplicate', 'missing'])(
  '%s 변경 결과는 해당 사용자 목록과 후보·미리보기만 갱신한다',
  async (scenario) => {
    const { client, wrapper } = setup()
    for (const key of [
      ['members', 'u', 'w', params],
      ['member-candidates', 'u', 'w', params],
      ['members', 'other', 'w', params],
    ])
      client.setQueryData(key, { members: [] })
    vi.mocked(axiosInstance.post).mockResolvedValue({ data: { member: {} } })
    vi.mocked(axiosInstance.delete).mockResolvedValue({ status: 204 })
    if (scenario === 'duplicate')
      vi.mocked(axiosInstance.post).mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 409,
          data: { error: { code: 'MEMBER_ALREADY_EXISTS' } },
        },
      })
    if (scenario === 'missing')
      vi.mocked(axiosInstance.delete).mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 404,
          data: { error: { code: 'MEMBER_NOT_FOUND' } },
        },
      })
    const { result } = renderHook(
      () => ({
        add: useAddMember('token', 'u', 'w'),
        remove: useRemoveMember('token', 'u', 'w'),
      }),
      { wrapper },
    )
    await act(async () => {
      try {
        await (
          scenario === 'missing' ? result.current.remove : result.current.add
        ).mutateAsync('target')
      } catch {
        /* 오류 후 재조회 검증 */
      }
    })
    expect(
      client.getQueryState(['members', 'u', 'w', params])?.isInvalidated,
    ).toBe(true)
    expect(
      client.getQueryState(['member-candidates', 'u', 'w', params])
        ?.isInvalidated,
    ).toBe(true)
    expect(
      client.getQueryState(['members', 'other', 'w', params])?.isInvalidated,
    ).toBe(false)
  },
)
