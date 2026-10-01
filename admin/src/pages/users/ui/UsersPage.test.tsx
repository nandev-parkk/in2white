import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  createUserRequest,
  listUsersRequest,
  type AdminUserListItem,
  type ListUsersResponse,
} from '@/entities/user'
import { toast } from '@in2white/ui/toast'

import { UsersPage } from './UsersPage'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/entities/user', () => ({
  listUsersRequest: vi.fn(),
  getUserRequest: vi.fn(),
  createUserRequest: vi.fn(),
  updateUserRequest: vi.fn(),
  resetUserPasswordRequest: vi.fn(),
  deactivateUserRequest: vi.fn(),
  reactivateUserRequest: vi.fn(),
  revokeUserSessionsRequest: vi.fn(),
  getUserDeletionImpactRequest: vi.fn(),
  deleteUserRequest: vi.fn(),
}))

vi.mock('@in2white/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const users: AdminUserListItem[] = [
  {
    id: 'user-1',
    name: '김하나',
    email: 'hana@in2white.team',
    deactivatedAt: null,
    createdAt: '2026-09-20T01:00:00.000Z',
    workspaceCount: 2,
  },
  {
    id: 'user-2',
    name: '이두리',
    email: 'duri@in2white.team',
    deactivatedAt: '2026-09-25T01:00:00.000Z',
    createdAt: '2026-09-21T01:00:00.000Z',
    workspaceCount: 1,
  },
]

function listResponse(
  overrides?: Partial<ListUsersResponse>,
): ListUsersResponse {
  return {
    users,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    ...overrides,
  }
}

function renderUsersPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <UsersPage />
    </QueryClientProvider>,
  )
}

/* Radix Select는 jsdom에 없는 포인터 API를 쓴다. 필터 동작을 테스트하려면 채워줘야 한다. */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

describe('UsersPage', () => {
  beforeEach(() => {
    vi.mocked(listUsersRequest).mockReset()
    vi.mocked(createUserRequest).mockReset()
    vi.mocked(toast.success).mockReset()
    navigateMock.mockReset()
  })

  it('사용자 목록을 표로 보여준다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(listResponse())

    renderUsersPage()

    expect(await screen.findByText('hana@in2white.team')).toBeInTheDocument()
    expect(screen.getByText('duri@in2white.team')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이두리' })).toBeInTheDocument()
    expect(vi.mocked(listUsersRequest).mock.calls[0][0]).toMatchObject({
      page: 1,
      status: 'all',
    })
  })

  it('이름을 누르면 상세 화면으로 이동한다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(listResponse())

    renderUsersPage()

    await userEvent.click(await screen.findByRole('button', { name: '김하나' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/users/$userId',
      params: { userId: 'user-1' },
    })
  })

  it('검색어를 입력하면 검색 조건으로 다시 조회한다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(listResponse())

    renderUsersPage()
    await screen.findByText('hana@in2white.team')

    await userEvent.type(screen.getByLabelText('사용자 검색'), '하나')

    await waitFor(() => {
      expect(listUsersRequest).toHaveBeenCalledWith(
        expect.objectContaining({ search: '하나', page: 1 }),
      )
    })
  })

  it('정지 필터를 바꾸면 해당 상태만 조회한다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(listResponse())

    renderUsersPage()
    await screen.findByText('hana@in2white.team')

    await userEvent.click(screen.getByRole('combobox', { name: '정지 여부' }))
    await userEvent.click(await screen.findByRole('option', { name: '정지' }))

    await waitFor(() => {
      expect(listUsersRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'deactivated' }),
      )
    })
  })

  it('사용자를 추가하면 토스트를 띄우고 모달을 닫는다', async () => {
    vi.mocked(listUsersRequest).mockResolvedValue(listResponse())
    vi.mocked(createUserRequest).mockResolvedValue({
      id: 'user-3',
      name: '박세찬',
      email: 'sechan@in2white.team',
      deactivatedAt: null,
      createdAt: '2026-09-30T01:00:00.000Z',
    })

    renderUsersPage()
    await screen.findByText('hana@in2white.team')

    await userEvent.click(screen.getByRole('button', { name: '사용자 추가' }))

    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('이메일'),
      'sechan@in2white.team',
    )
    await userEvent.type(within(dialog).getByLabelText('이름'), '박세찬')
    await userEvent.type(
      within(dialog).getByLabelText('비밀번호'),
      'Admin1234!',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: '사용자 추가' }),
    )

    await waitFor(() => {
      expect(createUserRequest).toHaveBeenCalledWith({
        email: 'sechan@in2white.team',
        name: '박세찬',
        password: 'Admin1234!',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('사용자를 추가했어요')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('조회에 실패하면 오류와 다시 시도 버튼을 보여준다', async () => {
    vi.mocked(listUsersRequest).mockRejectedValue(new Error('network'))

    renderUsersPage()

    expect(
      await screen.findByText('사용자 목록을 불러오지 못했어요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })
})
