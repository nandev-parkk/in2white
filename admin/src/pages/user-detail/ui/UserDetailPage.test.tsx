import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  deactivateUserRequest,
  deleteUserRequest,
  getUserDeletionImpactRequest,
  getUserRequest,
  reactivateUserRequest,
  resetUserPasswordRequest,
  revokeUserSessionsRequest,
  updateUserRequest,
  type AdminUser,
  type AdminUserDetail,
} from '@/entities/user'
import { toast } from '@in2white/ui/toast'

import { UserDetailPage } from './UserDetailPage'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
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

const user: AdminUser = {
  id: 'user-1',
  name: '김하나',
  email: 'hana@in2white.team',
  deactivatedAt: null,
  createdAt: '2026-09-20T01:00:00.000Z',
}

function detail(overrides?: Partial<AdminUserDetail>): AdminUserDetail {
  return {
    user,
    workspaces: [
      {
        id: 'workspace-1',
        name: '김하나의 워크스페이스',
        isDefault: true,
        role: 'owner',
        joinedAt: '2026-09-20T01:00:00.000Z',
      },
      {
        id: 'workspace-2',
        name: '디자인팀',
        isDefault: false,
        role: 'member',
        joinedAt: '2026-09-22T01:00:00.000Z',
      },
    ],
    createdProjectCount: 3,
    createdWhiteboardDocumentCount: 7,
    ...overrides,
  }
}

function renderUserDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <UserDetailPage userId="user-1" />
    </QueryClientProvider>,
  )
}

describe('UserDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getUserRequest).mockReset()
    vi.mocked(updateUserRequest).mockReset()
    vi.mocked(resetUserPasswordRequest).mockReset()
    vi.mocked(deactivateUserRequest).mockReset()
    vi.mocked(reactivateUserRequest).mockReset()
    vi.mocked(revokeUserSessionsRequest).mockReset()
    vi.mocked(getUserDeletionImpactRequest).mockReset()
    vi.mocked(deleteUserRequest).mockReset()
    vi.mocked(toast.success).mockReset()
    navigateMock.mockReset()
  })

  it('사용자 정보와 소속 워크스페이스, 만든 리소스 수를 보여준다', async () => {
    vi.mocked(getUserRequest).mockResolvedValue(detail())

    renderUserDetailPage()

    expect(await screen.findByText('hana@in2white.team')).toBeInTheDocument()
    expect(screen.getByText('디자인팀')).toBeInTheDocument()
    expect(screen.getByText('김하나의 워크스페이스')).toBeInTheDocument()
    expect(screen.getByText('3개')).toBeInTheDocument()
    expect(screen.getByText('7개')).toBeInTheDocument()
    expect(getUserRequest).toHaveBeenCalledWith('user-1')
  })

  it('활성 계정에는 계정 정지, 정지된 계정에는 정지 해제를 보여준다', async () => {
    vi.mocked(getUserRequest).mockResolvedValue(detail())

    const { unmount } = renderUserDetailPage()

    expect(
      await screen.findByRole('button', { name: '계정 정지' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '정지 해제' }),
    ).not.toBeInTheDocument()
    unmount()

    vi.mocked(getUserRequest).mockResolvedValue(
      detail({ user: { ...user, deactivatedAt: '2026-09-25T01:00:00.000Z' } }),
    )
    renderUserDetailPage()

    expect(
      await screen.findByRole('button', { name: '정지 해제' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '계정 정지' }),
    ).not.toBeInTheDocument()
  })

  it('계정 정지를 확인하면 정지 API를 호출하고 토스트를 띄운다', async () => {
    vi.mocked(getUserRequest).mockResolvedValue(detail())
    vi.mocked(deactivateUserRequest).mockResolvedValue({
      ...user,
      deactivatedAt: '2026-09-30T01:00:00.000Z',
    })

    renderUserDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '계정 정지' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: '계정 정지' }),
    )

    await waitFor(() => {
      expect(deactivateUserRequest).toHaveBeenCalledWith('user-1')
    })
    expect(toast.success).toHaveBeenCalledWith('계정을 정지했어요')
  })

  it('세션 강제 종료를 확인하면 세션 종료 API를 호출한다', async () => {
    vi.mocked(getUserRequest).mockResolvedValue(detail())
    vi.mocked(revokeUserSessionsRequest).mockResolvedValue(user)

    renderUserDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '세션 강제 종료' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: '세션 강제 종료' }),
    )

    await waitFor(() => {
      expect(revokeUserSessionsRequest).toHaveBeenCalledWith('user-1')
    })
    expect(toast.success).toHaveBeenCalledWith('모든 세션을 종료했어요')
  })

  it('비밀번호를 재설정하면 새 비밀번호를 보내고 토스트를 띄운다', async () => {
    vi.mocked(getUserRequest).mockResolvedValue(detail())
    vi.mocked(resetUserPasswordRequest).mockResolvedValue(user)

    renderUserDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '비밀번호 재설정' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(
      within(dialog).getByLabelText('새 비밀번호'),
      'Admin1234!',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: '비밀번호 재설정' }),
    )

    await waitFor(() => {
      expect(resetUserPasswordRequest).toHaveBeenCalledWith(
        'user-1',
        'Admin1234!',
      )
    })
    expect(toast.success).toHaveBeenCalledWith('비밀번호를 재설정했어요')
  })

  it('이름만 바꾸면 바뀐 항목만 보낸다', async () => {
    vi.mocked(getUserRequest).mockResolvedValue(detail())
    vi.mocked(updateUserRequest).mockResolvedValue({ ...user, name: '김하늘' })

    renderUserDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '정보 수정' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.clear(within(dialog).getByLabelText('이름'))
    await userEvent.type(within(dialog).getByLabelText('이름'), '김하늘')
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(updateUserRequest).toHaveBeenCalledWith('user-1', {
        name: '김하늘',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('사용자 정보를 수정했어요')
  })

  it('삭제 모달은 삭제 범위를 보여주고, 삭제 후 목록으로 이동한다', async () => {
    vi.mocked(getUserRequest).mockResolvedValue(detail())
    vi.mocked(getUserDeletionImpactRequest).mockResolvedValue({
      user,
      impact: {
        ownedWorkspaceCount: 1,
        otherWorkspaceMembershipCount: 1,
        projectCount: 3,
        whiteboardDocumentCount: 7,
      },
    })
    vi.mocked(deleteUserRequest).mockResolvedValue(undefined)

    renderUserDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '계정 삭제' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText('소유 워크스페이스 1개'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('화이트보드 문서 7개')).toBeInTheDocument()

    const confirmButton = within(dialog).getByRole('button', {
      name: '계정 삭제',
    })
    expect(confirmButton).toBeDisabled()

    await userEvent.type(
      within(dialog).getByLabelText('확인용 이메일'),
      'hana@in2white.team',
    )
    await userEvent.click(confirmButton)

    await waitFor(() => {
      expect(deleteUserRequest).toHaveBeenCalledWith(
        'user-1',
        'hana@in2white.team',
      )
    })
    expect(toast.success).toHaveBeenCalledWith('계정을 삭제했어요')
    expect(navigateMock).toHaveBeenCalledWith({ to: '/users', replace: true })
  })

  it('조회에 실패하면 오류를 보여준다', async () => {
    vi.mocked(getUserRequest).mockRejectedValue(new Error('network'))

    renderUserDetailPage()

    expect(
      await screen.findByText('사용자 정보를 불러오지 못했어요'),
    ).toBeInTheDocument()
  })
})
