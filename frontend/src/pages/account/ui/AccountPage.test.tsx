import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  changeAccountPasswordRequest,
  getAccountRequest,
  updateAccountRequest,
  type AccountUser,
} from '@/entities/account'
import { useSessionStore } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'

import { AccountPage } from './AccountPage'

const sessionUser: AccountUser = {
  id: 'user-1',
  name: '세션 사용자',
  email: 'session@in2white.team',
}

const accountUser: AccountUser = {
  ...sessionUser,
  name: '조회된 사용자',
  email: 'account@in2white.team',
}

const workspaces: WorkspaceSummary[] = [
  {
    id: 'workspace-1',
    name: '기본 워크스페이스',
    ownerId: 'user-1',
    isDefault: true,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    role: 'owner',
  },
  {
    id: 'workspace-2',
    name: '참여 중인 팀',
    ownerId: 'user-2',
    isDefault: false,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    role: 'member',
  },
]

const manyWorkspaces: WorkspaceSummary[] = [
  ...workspaces,
  {
    ...workspaces[1],
    id: 'workspace-3',
    name: '브랜드 스튜디오',
  },
  {
    ...workspaces[1],
    id: 'workspace-4',
    name: '마케팅 워크스페이스',
  },
  {
    ...workspaces[1],
    id: 'workspace-5',
    name: '프로덕트 랩',
  },
  {
    ...workspaces[1],
    id: 'workspace-6',
    name: '고객지원 팀',
  },
]

const mockNavigate = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
let mockWorkspaceShellState = {
  workspaceLoading: false,
  workspaceError: false,
  refetchWorkspaces: vi.fn(),
}
let mockAccountWorkspaces = workspaces

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/entities/account', () => ({
  getAccountRequest: vi.fn(),
  updateAccountRequest: vi.fn(),
  changeAccountPasswordRequest: vi.fn(),
}))

vi.mock('@/shared/ui/toast', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

vi.mock('@/pages/shared/ui/AuthenticatedWorkspaceLayout', () => ({
  AuthenticatedWorkspaceLayout: ({
    activeNav,
    children,
    onNavChange,
    onWorkspaceChange,
    workspaceMode,
    unknownWorkspace,
  }: {
    activeNav?: string
    children: (context: {
      accessToken: string
      user: AccountUser
      workspaces: WorkspaceSummary[]
      selectedWorkspace: WorkspaceSummary | null
      selectedWorkspaceId: string | null
      workspaceLoading: boolean
      workspaceError: boolean
      refetchWorkspaces: () => Promise<unknown> | unknown
    }) => ReactNode
    onNavChange?: (key: 'projects', workspaceId: string | null) => void
    onWorkspaceChange?: (workspaceId: string) => void
    workspaceMode?: string
    unknownWorkspace?: string
  }) => (
    <div
      data-active-nav={activeNav}
      data-testid="workspace-layout"
      data-workspace-mode={workspaceMode}
      data-unknown-workspace={unknownWorkspace}
    >
      <button onClick={() => onWorkspaceChange?.('workspace-2')} type="button">
        워크스페이스 전환
      </button>
      <button
        onClick={() => onNavChange?.('projects', 'workspace-2')}
        type="button"
      >
        프로젝트 메뉴
      </button>
      {children({
        accessToken: 'token-1',
        user: sessionUser,
        workspaces: mockAccountWorkspaces,
        selectedWorkspace: mockAccountWorkspaces[0],
        selectedWorkspaceId: 'workspace-1',
        ...mockWorkspaceShellState,
      })}
    </div>
  ),
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })
}

function renderAccountPage(props = {}) {
  const queryClient = createQueryClient()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AccountPage {...props} />
    </QueryClientProvider>,
  )

  return { ...view, queryClient }
}

async function submitPassword(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('현재 비밀번호'), 'Old123!')
  await user.type(screen.getByLabelText('새 비밀번호'), 'New12345!')
  await user.type(screen.getByLabelText('새 비밀번호 확인'), 'New12345!')
  await user.click(screen.getByRole('button', { name: '변경' }))
}

describe('AccountPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionStore.getState().clearSession()
    useSessionStore.getState().setSession('token-1', sessionUser)
    mockWorkspaceShellState = {
      workspaceLoading: false,
      workspaceError: false,
      refetchWorkspaces: vi.fn(),
    }
    mockAccountWorkspaces = workspaces
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('페이지 제목은 전폭 시작점에 두고 섹션 컬럼은 중앙 480px과 28px 간격을 유지한다', () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)

    renderAccountPage()

    const pageHeader = screen
      .getByText('계정 설정')
      .closest('[data-slot="page-header"]')
    const profileSection = screen
      .getByRole('heading', { name: '기본 정보' })
      .closest('section')
    const sectionColumn = profileSection?.parentElement

    expect(pageHeader).toHaveClass('max-sm:pl-2')
    expect(pageHeader?.parentElement).toHaveClass('w-full', 'gap-7')
    expect(sectionColumn).toHaveClass('mx-auto', 'max-w-[480px]', 'gap-10')
    expect(pageHeader?.parentElement).not.toBe(sectionColumn)
  })

  it('선택된 workspace row만 강조하고 avatar에는 이름 첫 글자만 표시한다', () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)

    renderAccountPage()

    const selectedWorkspace = screen.getByRole('button', {
      name: /기본 워크스페이스.*소유자/,
    })
    const otherWorkspace = screen.getByRole('button', {
      name: /참여 중인 팀.*멤버/,
    })

    expect(selectedWorkspace).toHaveClass('bg-background-subtle', 'rounded-md')
    expect(otherWorkspace).not.toHaveClass('bg-background-subtle', 'rounded-md')
    expect(
      within(selectedWorkspace).getByText('기', {
        selector: '[data-slot="avatar-fallback"]',
      }),
    ).toBeInTheDocument()
    expect(
      within(otherWorkspace).getByText('참', {
        selector: '[data-slot="avatar-fallback"]',
      }),
    ).toBeInTheDocument()
  })

  it('참여 workspace 목록은 4개 행 높이로 제한하고 기존 검색 UI를 사용한다', () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)
    mockAccountWorkspaces = manyWorkspaces

    renderAccountPage()

    const searchbox = screen.getByRole('searchbox', {
      name: '워크스페이스 검색',
    })
    const workspaceList = screen.getByTestId('account-workspaces-list')

    expect(searchbox).toHaveAttribute('placeholder', '워크스페이스 검색')
    expect(searchbox).toHaveClass('w-full')
    expect(workspaceList).toHaveClass('max-h-[248px]', 'overflow-y-auto')
  })

  it('워크스페이스 이름을 검색하고 결과가 없으면 기존 안내 문구를 표시한다', async () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)
    mockAccountWorkspaces = manyWorkspaces
    const user = userEvent.setup()

    renderAccountPage()

    const searchbox = screen.getByRole('searchbox', {
      name: '워크스페이스 검색',
    })
    await user.type(searchbox, '브랜드')

    expect(
      screen.getByRole('button', { name: /브랜드 스튜디오.*멤버/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /기본 워크스페이스.*소유자/ }),
    ).not.toBeInTheDocument()

    await user.clear(searchbox)
    await user.type(searchbox, '없는 워크스페이스')

    expect(screen.getByText('워크스페이스가 없습니다')).toBeInTheDocument()
  })

  it('조회된 계정과 참여 workspace의 역할을 표시하고 workspace row를 프로젝트로 이동한다', async () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)

    renderAccountPage()

    await waitFor(() => {
      expect(screen.getByLabelText('아이디')).toHaveValue(
        'account@in2white.team',
      )
    })
    expect(screen.getByLabelText('아이디')).toBeDisabled()
    expect(screen.getByLabelText('이름')).toHaveValue('조회된 사용자')
    expect(screen.getByText('기본 워크스페이스')).toBeInTheDocument()
    expect(screen.getByText('소유자')).toBeInTheDocument()
    expect(screen.getByText('참여 중인 팀')).toBeInTheDocument()
    expect(screen.getByText('멤버')).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: /참여 중인 팀.*멤버/ }),
    )

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/workspaces/$workspaceId/projects',
      params: { workspaceId: 'workspace-2' },
    })
  })

  it('workspace row는 제공된 project navigation callback을 우선 사용한다', async () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)
    const onNavChange = vi.fn()

    renderAccountPage({ onNavChange })

    await screen.findByDisplayValue('조회된 사용자')
    await userEvent.click(
      screen.getByRole('button', { name: /참여 중인 팀.*멤버/ }),
    )

    expect(onNavChange).toHaveBeenCalledWith('projects', 'workspace-2')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('이름 변경 성공 시 현재 token과 갱신된 사용자를 세션에 저장하고 성공 toast를 표시한다', async () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)
    vi.mocked(updateAccountRequest).mockResolvedValue({
      ...accountUser,
      name: '새 이름',
    })
    const user = userEvent.setup()

    renderAccountPage()

    await screen.findByDisplayValue('조회된 사용자')
    await user.clear(screen.getByLabelText('이름'))
    await user.type(screen.getByLabelText('이름'), '새 이름')
    await user.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => {
      expect(useSessionStore.getState()).toMatchObject({
        accessToken: 'token-1',
        user: { ...accountUser, name: '새 이름' },
      })
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('이름을 저장했어요')
    expect(screen.getByLabelText('이름')).toHaveValue('새 이름')
  })

  it('비밀번호 변경 성공 시 새 token과 user를 세션에 저장하고 form을 초기화한다', async () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)
    vi.mocked(changeAccountPasswordRequest).mockResolvedValue({
      accessToken: 'token-2',
      user: { ...accountUser, name: '새 이름' },
    })
    const user = userEvent.setup()

    renderAccountPage()

    await screen.findByDisplayValue('조회된 사용자')
    await submitPassword(user)

    await waitFor(() => {
      expect(useSessionStore.getState()).toMatchObject({
        accessToken: 'token-2',
        user: { ...accountUser, name: '새 이름' },
      })
    })
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('')
    expect(mockToastSuccess).toHaveBeenCalledWith('비밀번호를 변경했어요')
  })

  it('재인증 필요 비밀번호 오류는 세션을 지우고 로그인으로 replace 이동한다', async () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)
    vi.mocked(changeAccountPasswordRequest).mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          error: {
            code: 'PASSWORD_CHANGED_REAUTH_REQUIRED',
            message: '다시 로그인해주세요',
          },
        },
      },
    })
    const user = userEvent.setup()
    const clearSessionSpy = vi.spyOn(useSessionStore.getState(), 'clearSession')

    renderAccountPage()

    await screen.findByDisplayValue('조회된 사용자')
    await submitPassword(user)

    await waitFor(() => {
      expect(useSessionStore.getState().accessToken).toBeNull()
    })
    expect(mockToastError).toHaveBeenCalledWith('다시 로그인해주세요')
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/login', replace: true })
    expect(clearSessionSpy.mock.invocationCallOrder[0]).toBeLessThan(
      mockNavigate.mock.invocationCallOrder[0],
    )
  })

  it('계정 조회 실패는 오류와 재시도 action을 표시한다', async () => {
    vi.mocked(getAccountRequest)
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(accountUser)
    const user = userEvent.setup()

    renderAccountPage()

    expect(
      await screen.findByText('계정 정보를 불러오지 못했어요'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '다시 시도' }))

    await waitFor(() => {
      expect(screen.getByLabelText('이름')).toHaveValue('조회된 사용자')
    })
    expect(getAccountRequest).toHaveBeenCalledTimes(2)
  })

  it('계정 조회 중에는 session user를 표시하고 shell callbacks를 그대로 위임한다', async () => {
    let resolveAccount: (user: AccountUser) => void = () => undefined
    vi.mocked(getAccountRequest).mockReturnValue(
      new Promise<AccountUser>((resolve) => {
        resolveAccount = resolve
      }),
    )
    const onWorkspaceChange = vi.fn()
    const onNavChange = vi.fn()
    const user = userEvent.setup()

    renderAccountPage({
      onWorkspaceChange,
      onNavChange,
      workspaceId: 'missing',
    })

    expect(screen.getByTestId('workspace-layout')).toHaveAttribute(
      'data-active-nav',
      'settings',
    )
    expect(screen.getByTestId('workspace-layout')).toHaveAttribute(
      'data-unknown-workspace',
      'fallback',
    )
    expect(screen.getByTestId('workspace-layout')).toHaveAttribute(
      'data-workspace-mode',
      'optional',
    )
    expect(screen.getByLabelText('아이디')).toHaveValue('session@in2white.team')
    expect(screen.getByLabelText('이름')).toHaveValue('세션 사용자')

    await user.click(screen.getByRole('button', { name: '워크스페이스 전환' }))
    await user.click(screen.getByRole('button', { name: '프로젝트 메뉴' }))

    expect(onWorkspaceChange).toHaveBeenCalledWith('workspace-2')
    expect(onNavChange).toHaveBeenCalledWith('projects', 'workspace-2')

    resolveAccount(accountUser)
    await waitFor(() => {
      expect(screen.getByLabelText('이름')).toHaveValue('조회된 사용자')
    })
  })

  it('query 결과가 도착해도 dirty 상태의 이름 draft는 보존하고 최신 user prop은 반영한다', async () => {
    let resolveAccount: (user: AccountUser) => void = () => undefined
    vi.mocked(getAccountRequest).mockReturnValue(
      new Promise<AccountUser>((resolve) => {
        resolveAccount = resolve
      }),
    )
    const user = userEvent.setup()

    renderAccountPage()

    const nameInput = screen.getByLabelText('이름')
    await user.clear(nameInput)
    await user.type(nameInput, '편집 중인 이름')
    expect(nameInput).toHaveValue('편집 중인 이름')

    resolveAccount({
      ...sessionUser,
      email: 'account@in2white.team',
    })

    await waitFor(() => {
      expect(screen.getByLabelText('아이디')).toHaveValue(
        'account@in2white.team',
      )
    })
    expect(screen.getByLabelText('이름')).toHaveValue('편집 중인 이름')
  })

  it('workspace query loading과 error 중에도 계정 콘텐츠와 참여 섹션 상태를 표시한다', async () => {
    vi.mocked(getAccountRequest).mockResolvedValue(accountUser)
    const user = userEvent.setup()

    mockWorkspaceShellState.workspaceLoading = true
    const loadingView = renderAccountPage()

    expect(screen.getByText('계정 설정')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '기본 정보' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '참여 워크스페이스' }),
    ).toBeInTheDocument()
    expect(screen.getByText('워크스페이스 불러오는 중')).toBeInTheDocument()
    loadingView.unmount()

    mockWorkspaceShellState.workspaceLoading = false
    mockWorkspaceShellState.workspaceError = true
    mockWorkspaceShellState.refetchWorkspaces = vi.fn()

    renderAccountPage()

    expect(
      screen.getByRole('heading', { name: '기본 정보' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '워크스페이스를 불러오지 못했어요',
    )
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(mockWorkspaceShellState.refetchWorkspaces).toHaveBeenCalledOnce()
  })
})
