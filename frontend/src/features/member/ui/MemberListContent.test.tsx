import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axiosInstance } from '@/shared/api'
import { MemberListContent } from './MemberListContent'
vi.mock('@/shared/api', () => ({
  axiosInstance: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))
const owner = {
  userId: 'owner',
  name: '소유자',
  email: 'owner@example.com',
  role: 'owner',
  joinedAt: '2026-09-13T16:00:00Z',
}
const member = {
  userId: 'member',
  name: '민지',
  email: 'minji@example.com',
  role: 'member',
  joinedAt: '2026-09-01T00:00:00Z',
}
const list = {
  members: [owner, member],
  pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
}
function mount(role: 'owner' | 'member' = 'owner', canAddMember = true) {
  const onAccessLost = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const props = {
    accessToken: 'token',
    userId: 'owner',
    workspaceId: 'ws',
    workspaceRole: role,
    canAddMember: canAddMember && role === 'owner',
    onAccessLost,
  }
  return {
    ...render(
      <QueryClientProvider client={client}>
        <MemberListContent {...props} />
      </QueryClientProvider>,
    ),
    onAccessLost,
  }
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(axiosInstance.get).mockImplementation(async (url) => ({
    data: String(url).includes('member-candidates')
      ? {
          users: [
            {
              id: 'candidate',
              name: '하늘',
              email: 'sky@example.com',
              isMember: false,
            },
          ],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }
      : list,
  }))
})
it('한국 시간 합류일과 owner 전용 액션을 표시하고 자신은 제거하지 않는다', async () => {
  mount()
  expect(await screen.findByText('합류일 2026.09.14')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: '민지 내보내기' }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: '소유자 내보내기' }),
  ).not.toBeInTheDocument()
})
it('일반 멤버에게는 추가·제거 액션이 없다', async () => {
  mount('member')
  await screen.findByText('minji@example.com')
  expect(
    screen.queryByRole('button', { name: '멤버 추가' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /내보내기/ }),
  ).not.toBeInTheDocument()
})
it('검색을 300ms 디바운스하고 페이지를 1로 초기화한다', async () => {
  mount()
  await screen.findByText('minji@example.com')
  await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
  vi.useFakeTimers()
  fireEvent.change(screen.getByRole('searchbox', { name: '멤버 검색' }), {
    target: { value: '민지' },
  })
  await act(() => vi.advanceTimersByTimeAsync(299))
  expect(axiosInstance.get).not.toHaveBeenCalledWith(
    '/workspaces/ws/members',
    expect.objectContaining({
      params: expect.objectContaining({ search: '민지' }),
    }),
  )
  await act(() => vi.advanceTimersByTimeAsync(1))
  expect(axiosInstance.get).toHaveBeenLastCalledWith(
    '/workspaces/ws/members',
    expect.objectContaining({ params: { search: '민지', page: 1, limit: 20 } }),
  )
  vi.useRealTimers()
})
it('후보 선택 중 중복 제출을 막고 성공해도 모달을 유지한다', async () => {
  let resolve!: (value: unknown) => void
  vi.mocked(axiosInstance.post).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  mount()
  await userEvent.click(screen.getByRole('button', { name: '멤버 추가' }))
  const candidate = await screen.findByRole('button', { name: /하늘/ })
  await userEvent.dblClick(candidate)
  expect(axiosInstance.post).toHaveBeenCalledTimes(1)
  expect(candidate).toBeDisabled()
  await act(async () => resolve({ data: { member } }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
it('멤버 추가가 막힌 워크스페이스에서는 추가 버튼을 숨긴다', async () => {
  mount('owner', false)
  await screen.findByText('minji@example.com')
  expect(
    screen.queryByRole('button', { name: '멤버 추가' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: '민지 내보내기' }),
  ).toBeInTheDocument()
})
it('제거는 확인 후 요청하고 실패하면 오류를 표시하여 재시도한다', async () => {
  vi.mocked(axiosInstance.delete)
    .mockRejectedValueOnce(new Error('private server detail'))
    .mockResolvedValueOnce({ status: 204 })
  mount()
  await userEvent.click(
    await screen.findByRole('button', { name: '민지 내보내기' }),
  )
  expect(axiosInstance.delete).not.toHaveBeenCalled()
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: '내보내기',
    }),
  )
  expect(await screen.findByRole('alert')).not.toHaveTextContent(
    'private server detail',
  )
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: '내보내기',
    }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
})
it('워크스페이스 접근 상실을 상위 셸에 알린다', async () => {
  vi.mocked(axiosInstance.get).mockRejectedValue({
    isAxiosError: true,
    response: { status: 404, data: { error: { code: 'WORKSPACE_NOT_FOUND' } } },
  })
  const { onAccessLost } = mount()
  await waitFor(() => expect(onAccessLost).toHaveBeenCalled())
})
it('초기 로딩에는 skeleton, 실패에는 다시 시도, 빈 검색에는 초기화를 제공한다', async () => {
  let reject!: (error: unknown) => void
  vi.mocked(axiosInstance.get).mockImplementationOnce(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail
      }),
  )
  mount()
  expect(
    await screen.findByRole('status', { name: '멤버 불러오는 중' }),
  ).toBeInTheDocument()
  await act(async () =>
    reject({
      isAxiosError: true,
      response: {
        status: 404,
        data: { error: { code: 'WORKSPACE_NOT_FOUND' } },
      },
    }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: '다시 시도' }),
  )
  await screen.findByText('minji@example.com')
  vi.mocked(axiosInstance.get).mockResolvedValue({
    data: {
      members: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    },
  })
  fireEvent.change(screen.getByRole('searchbox', { name: '멤버 검색' }), {
    target: { value: '없는 사람' },
  })
  await userEvent.click(
    await screen.findByRole('button', { name: '검색 결과 초기화' }),
  )
  expect(screen.getByRole('searchbox', { name: '멤버 검색' })).toHaveValue('')
})
it('마지막 페이지의 마지막 멤버 제거 후 이전 페이지로 보정한다', async () => {
  let removed = false
  vi.mocked(axiosInstance.get).mockImplementation(async (_url, config) => ({
    data:
      (config?.params as { page: number } | undefined)?.page === 2
        ? {
            members: removed ? [] : [member],
            pagination: {
              page: 2,
              limit: 20,
              total: removed ? 20 : 21,
              totalPages: removed ? 1 : 2,
            },
          }
        : list,
  }))
  vi.mocked(axiosInstance.delete).mockImplementation(async () => {
    removed = true
    return { status: 204 }
  })
  mount()
  await userEvent.click(
    await screen.findByRole('button', { name: '다음 페이지' }),
  )
  await userEvent.click(
    await screen.findByRole('button', { name: '민지 내보내기' }),
  )
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: '내보내기',
    }),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute(
      'aria-current',
      'page',
    ),
  )
})
it('추가 실패 후 재시도할 수 있고 닫으면 검색 상태와 포커스를 복원한다', async () => {
  vi.mocked(axiosInstance.post)
    .mockRejectedValueOnce(new Error('private detail'))
    .mockResolvedValueOnce({ data: { member } })
  mount()
  const trigger = screen.getByRole('button', { name: '멤버 추가' })
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole('button', { name: /하늘/ }))
  expect(await screen.findByRole('alert')).not.toHaveTextContent(
    'private detail',
  )
  await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await userEvent.click(await screen.findByRole('button', { name: /하늘/ }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /하늘/ })).toBeDisabled(),
  )
  await userEvent.click(screen.getByRole('button', { name: '닫기' }))
  expect(trigger).toHaveFocus()
  await userEvent.click(trigger)
  expect(
    screen.getByRole('searchbox', { name: '추가할 사용자 검색' }),
  ).toHaveValue('')
})
