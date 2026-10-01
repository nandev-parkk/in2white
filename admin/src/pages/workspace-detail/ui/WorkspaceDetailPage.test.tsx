import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { listUsersRequest } from '@/entities/user'
import {
  addWorkspaceMemberRequest,
  deleteWorkspaceRequest,
  getWorkspaceRequest,
  removeWorkspaceMemberRequest,
  transferWorkspaceOwnerRequest,
  updateWorkspaceRequest,
  type AdminWorkspaceDetail,
} from '@/entities/workspace'
import { toast } from '@in2white/ui/toast'

import { WorkspaceDetailPage } from './WorkspaceDetailPage'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('@/entities/user', () => ({ listUsersRequest: vi.fn() }))

vi.mock('@/entities/workspace', () => ({
  listWorkspacesRequest: vi.fn(),
  getWorkspaceRequest: vi.fn(),
  updateWorkspaceRequest: vi.fn(),
  transferWorkspaceOwnerRequest: vi.fn(),
  addWorkspaceMemberRequest: vi.fn(),
  removeWorkspaceMemberRequest: vi.fn(),
  deleteWorkspaceRequest: vi.fn(),
}))

vi.mock('@in2white/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const owner = { id: 'user-1', name: '김하나', email: 'hana@in2white.team' }

const workspace = {
  id: 'workspace-1',
  name: '디자인팀',
  isDefault: false,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
  owner,
}

function detail(
  overrides?: Partial<AdminWorkspaceDetail>,
): AdminWorkspaceDetail {
  return {
    workspace,
    members: [
      {
        userId: 'user-1',
        name: '김하나',
        email: 'hana@in2white.team',
        deactivatedAt: null,
        role: 'owner',
        joinedAt: '2026-09-20T00:00:00.000Z',
      },
      {
        userId: 'user-2',
        name: '이두리',
        email: 'duri@in2white.team',
        deactivatedAt: null,
        role: 'member',
        joinedAt: '2026-09-21T00:00:00.000Z',
      },
    ],
    projects: [
      {
        id: 'project-1',
        name: '랜딩 리뉴얼',
        creator: { id: 'user-1', name: '김하나' },
        whiteboardDocumentCount: 4,
        deletedAt: null,
        createdAt: '2026-09-22T00:00:00.000Z',
      },
      {
        id: 'project-2',
        name: '지난 캠페인',
        creator: { id: 'user-2', name: '이두리' },
        whiteboardDocumentCount: 0,
        deletedAt: '2026-09-28T00:00:00.000Z',
        createdAt: '2026-09-23T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

function renderWorkspaceDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceDetailPage workspaceId="workspace-1" />
    </QueryClientProvider>,
  )
}

/* Radix Select는 jsdom에 없는 포인터 API를 쓴다. */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

describe('WorkspaceDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getWorkspaceRequest).mockReset()
    vi.mocked(updateWorkspaceRequest).mockReset()
    vi.mocked(transferWorkspaceOwnerRequest).mockReset()
    vi.mocked(addWorkspaceMemberRequest).mockReset()
    vi.mocked(removeWorkspaceMemberRequest).mockReset()
    vi.mocked(deleteWorkspaceRequest).mockReset()
    vi.mocked(listUsersRequest).mockReset()
    vi.mocked(toast.success).mockReset()
    navigateMock.mockReset()
  })

  it('기본 정보와 멤버 목록을 보여준다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(detail())

    renderWorkspaceDetailPage()

    expect(await screen.findByText('디자인팀')).toBeInTheDocument()
    expect(screen.getByText('김하나 (hana@in2white.team)')).toBeInTheDocument()
    expect(screen.getByText('hana@in2white.team')).toBeInTheDocument()
    expect(screen.getByText('duri@in2white.team')).toBeInTheDocument()
    expect(getWorkspaceRequest).toHaveBeenCalledWith('workspace-1')
  })

  /* 삭제된 프로젝트까지 보여야 복구 대상을 어드민이 찾을 수 있다. */
  it('프로젝트 탭에서 삭제된 프로젝트까지 보여준다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(detail())

    renderWorkspaceDetailPage()

    await userEvent.click(await screen.findByRole('tab', { name: '프로젝트' }))

    expect(await screen.findByText('랜딩 리뉴얼')).toBeInTheDocument()
    expect(screen.getByText('지난 캠페인')).toBeInTheDocument()
    expect(screen.getByText('삭제됨')).toBeInTheDocument()
  })

  it('이름을 바꾸면 변경 API를 호출하고 토스트를 띄운다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(detail())
    vi.mocked(updateWorkspaceRequest).mockResolvedValue({
      ...workspace,
      name: '브랜드팀',
    })

    renderWorkspaceDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '이름 변경' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.clear(within(dialog).getByLabelText('워크스페이스 이름'))
    await userEvent.type(
      within(dialog).getByLabelText('워크스페이스 이름'),
      '브랜드팀',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(updateWorkspaceRequest).toHaveBeenCalledWith('workspace-1', {
        name: '브랜드팀',
      })
    })
    expect(toast.success).toHaveBeenCalledWith('워크스페이스 이름을 변경했어요')
  })

  it('소유자를 이전하면 선택한 멤버 id를 보낸다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(detail())
    vi.mocked(transferWorkspaceOwnerRequest).mockResolvedValue({
      workspace,
      owner: { id: 'user-2', name: '이두리', email: 'duri@in2white.team' },
    })

    renderWorkspaceDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '소유자 이전' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('combobox', { name: '새 소유자' }),
    )
    await userEvent.click(
      await screen.findByRole('option', {
        name: '이두리 (duri@in2white.team)',
      }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '이전' }))

    await waitFor(() => {
      expect(transferWorkspaceOwnerRequest).toHaveBeenCalledWith(
        'workspace-1',
        'user-2',
      )
    })
    expect(toast.success).toHaveBeenCalledWith('소유자를 이전했어요')
  })

  it('멤버를 추가하면 고른 사용자 id를 보낸다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(detail())
    vi.mocked(listUsersRequest).mockResolvedValue({
      users: [
        {
          id: 'user-3',
          name: '박세찬',
          email: 'sechan@in2white.team',
          deactivatedAt: null,
          createdAt: '2026-09-24T00:00:00.000Z',
          workspaceCount: 1,
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })
    vi.mocked(addWorkspaceMemberRequest).mockResolvedValue({
      userId: 'user-3',
      name: '박세찬',
      email: 'sechan@in2white.team',
      deactivatedAt: null,
      role: 'member',
      joinedAt: '2026-09-30T00:00:00.000Z',
    })

    renderWorkspaceDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '멤버 추가' }),
    )

    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      await within(dialog).findByRole('button', {
        name: /sechan@in2white.team/,
      }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '추가' }))

    await waitFor(() => {
      expect(addWorkspaceMemberRequest).toHaveBeenCalledWith(
        'workspace-1',
        'user-3',
      )
    })
    expect(toast.success).toHaveBeenCalledWith('멤버를 추가했어요')
  })

  it('멤버를 제거하면 제거 API를 호출한다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(detail())
    vi.mocked(removeWorkspaceMemberRequest).mockResolvedValue(undefined)

    renderWorkspaceDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '이두리 제거' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '제거' }))

    await waitFor(() => {
      expect(removeWorkspaceMemberRequest).toHaveBeenCalledWith(
        'workspace-1',
        'user-2',
      )
    })
    expect(toast.success).toHaveBeenCalledWith('멤버를 제거했어요')
  })

  /* 소유자는 백엔드가 403으로 막는다. 버튼을 두면 어드민이 막힌 작업을 계속 시도한다. */
  it('소유자에게는 제거 버튼을 보여주지 않는다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(detail())

    renderWorkspaceDetailPage()

    await screen.findByText('duri@in2white.team')

    expect(
      screen.queryByRole('button', { name: '김하나 제거' }),
    ).not.toBeInTheDocument()
  })

  it('워크스페이스를 삭제하면 목록으로 이동한다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(detail())
    vi.mocked(deleteWorkspaceRequest).mockResolvedValue(undefined)

    renderWorkspaceDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '워크스페이스 삭제' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(
      within(dialog).getByRole('button', { name: '워크스페이스 삭제' }),
    )

    await waitFor(() => {
      expect(deleteWorkspaceRequest).toHaveBeenCalledWith('workspace-1')
    })
    expect(toast.success).toHaveBeenCalledWith('워크스페이스를 삭제했어요')
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces',
      replace: true,
    })
  })

  /* 기본 워크스페이스를 바꾸면 제품의 "사용자마다 기본 워크스페이스 하나" 불변식이 깨진다. */
  it('기본 워크스페이스에서는 막힌 작업을 아예 보여주지 않는다', async () => {
    vi.mocked(getWorkspaceRequest).mockResolvedValue(
      detail({
        workspace: {
          ...workspace,
          name: '김하나의 워크스페이스',
          isDefault: true,
        },
        members: [
          {
            userId: 'user-1',
            name: '김하나',
            email: 'hana@in2white.team',
            deactivatedAt: null,
            role: 'owner',
            joinedAt: '2026-09-20T00:00:00.000Z',
          },
        ],
        projects: [],
      }),
    )

    renderWorkspaceDetailPage()

    expect(
      await screen.findByText(
        '기본 워크스페이스는 이름 변경·멤버 추가·삭제를 할 수 없어요',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '이름 변경' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '멤버 추가' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '워크스페이스 삭제' }),
    ).not.toBeInTheDocument()
  })

  it('조회에 실패하면 오류를 보여준다', async () => {
    vi.mocked(getWorkspaceRequest).mockRejectedValue(new Error('network'))

    renderWorkspaceDetailPage()

    expect(
      await screen.findByText('워크스페이스 정보를 불러오지 못했어요'),
    ).toBeInTheDocument()
  })
})
