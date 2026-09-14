import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axiosInstance } from '@/shared/api'
import { MemberAddDialog } from './MemberAddDialog'
vi.mock('@/shared/api', () => ({
  axiosInstance: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))
const candidates = {
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
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemberAddDialog
        accessToken="token"
        userId="owner"
        workspaceId="ws"
        onClose={vi.fn()}
        onAccessLost={vi.fn()}
      />
    </QueryClientProvider>,
  )
}
function deferCandidates() {
  let resolve!: (value: unknown) => void
  vi.mocked(axiosInstance.get).mockImplementationOnce(
    () =>
      new Promise((settle) => {
        resolve = settle as (value: unknown) => void
      }),
  )
  return () => resolve({ data: candidates })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(axiosInstance.get).mockResolvedValue({ data: candidates })
  vi.mocked(axiosInstance.post).mockResolvedValue({
    data: { member: { userId: 'candidate' } },
  })
})
it('멤버 추가 후 재조회 중에도 후보 목록을 유지하고 로딩으로 교체하지 않는다', async () => {
  mount()
  const candidate = await screen.findByRole('button', { name: /하늘/ })
  const settleRefetch = deferCandidates()

  await userEvent.click(candidate)

  expect(screen.getByText(/sky@example\.com/)).toBeInTheDocument()
  expect(screen.queryByText('사용자 불러오는 중')).not.toBeInTheDocument()

  await act(async () => {
    settleRefetch()
  })
  expect(screen.getByText(/sky@example\.com/)).toBeInTheDocument()
})
it('검색어를 바꿔 재조회하는 동안 이전 결과를 유지한다', async () => {
  mount()
  await screen.findByRole('button', { name: /하늘/ })
  const settleRefetch = deferCandidates()

  vi.useFakeTimers()
  fireEvent.change(
    screen.getByRole('searchbox', { name: '추가할 사용자 검색' }),
    { target: { value: '하' } },
  )
  await act(() => vi.advanceTimersByTimeAsync(300))

  expect(screen.getByText('sky@example.com')).toBeInTheDocument()
  expect(screen.queryByText('사용자 불러오는 중')).not.toBeInTheDocument()

  await act(async () => {
    settleRefetch()
  })
  vi.useRealTimers()
})
it('모달을 처음 열 때만 로딩 상태를 표시한다', async () => {
  const settleFirstLoad = deferCandidates()
  mount()

  expect(screen.getByText('사용자 불러오는 중')).toBeInTheDocument()

  await act(async () => {
    settleFirstLoad()
  })
  expect(await screen.findByRole('button', { name: /하늘/ })).toBeVisible()
  expect(screen.queryByText('사용자 불러오는 중')).not.toBeInTheDocument()
})
