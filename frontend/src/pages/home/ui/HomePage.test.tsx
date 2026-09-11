import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'
import { toast } from '@/shared/ui/toast'

import { HomePage } from './HomePage'

const userFixture = {
  id: 'user-1',
  name: '테스터',
  email: 'user@in2white.team',
}

const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const createdWorkspaceFixture: WorkspaceSummary = {
  ...workspaceFixture,
  id: 'workspace-2',
  name: '새 팀',
  isDefault: false,
}

const otherWorkspaceFixture: WorkspaceSummary = {
  ...workspaceFixture,
  id: 'workspace-3',
  name: '다른 팀',
  isDefault: false,
}

const mockUseWorkspaces = vi.fn()
const mockUseCreateWorkspace = vi.fn()
const mockNavigate = vi.fn()
const mockLogoutRequest = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/features/auth/api/session', () => ({
  logoutRequest: (...args: unknown[]) => mockLogoutRequest(...args),
}))

vi.mock('@/features/workspace', () => ({
  useWorkspaces: (...args: unknown[]) => mockUseWorkspaces(...args),
  useCreateWorkspace: (...args: unknown[]) => mockUseCreateWorkspace(...args),
}))

vi.mock('@/features/project/ui/ProjectListContent', () => ({
  ProjectListContent: () => <div data-testid="project-list-content" />,
}))

vi.mock('@/shared/ui/toast', () => ({
  toast: { success: vi.fn() },
}))

function renderHomePage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  )

  return {
    ...view,
    rerenderHomePage: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <HomePage />
        </QueryClientProvider>,
      ),
  }
}

describe('HomePage', () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession()
    mockUseWorkspaces.mockReset()
    mockUseCreateWorkspace.mockReset()
    mockNavigate.mockReset()
    mockLogoutRequest.mockReset()
    vi.mocked(toast.success).mockReset()
    mockLogoutRequest.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('세션이 없으면 워크스페이스 훅을 실행하지 않고 아무것도 표시하지 않는다', () => {
    renderHomePage()

    expect(screen.queryByText('로그인이 필요해요')).not.toBeInTheDocument()
    expect(mockUseWorkspaces).not.toHaveBeenCalled()
    expect(mockUseCreateWorkspace).not.toHaveBeenCalled()
  })

  it('워크스페이스를 불러오는 동안 로딩 상태를 표시한다', () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    mockUseWorkspaces.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    expect(screen.getAllByText('워크스페이스 불러오는 중')).toHaveLength(2)
  })

  it('좁은 화면에서는 사이드바를 접어 본문과 겹치지 않게 한다', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        media: '(max-width: 639px)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    )
    useSessionStore.getState().setSession('token-1', userFixture)
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    expect(screen.getByRole('complementary')).toHaveClass(
      'w-(--layout-sidebar-width-collapsed)',
    )
  })

  it('Figma 기준 흰색 페이지와 사이드바 구분선을 사용한다', () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    const sidebar = screen.getByRole('complementary', {
      name: '워크스페이스 사이드바',
    })
    expect(sidebar).toHaveClass('border-sidebar-border')
    expect(sidebar.parentElement).toHaveClass('bg-background-default')
  })

  it('생성 중에는 모달을 닫아 mutation을 초기화할 수 없다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    const reset = vi.fn()
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
      error: null,
      reset,
    })

    renderHomePage()

    await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
    await userEvent.click(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(reset).not.toHaveBeenCalled()
  })

  it('로그아웃을 선택하면 세션을 비우고 로그인 페이지로 이동한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login', replace: true })
    })
    expect(screen.queryByText('로그인이 필요해요')).not.toBeInTheDocument()
    expect(useSessionStore.getState().accessToken).toBeNull()
  })

  it('로그아웃 API가 실패해도 세션을 비우고 로그인 페이지로 이동한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    mockLogoutRequest.mockRejectedValueOnce(new Error('logout failed'))
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith({ to: '/login', replace: true })
    })
    expect(useSessionStore.getState().accessToken).toBeNull()
  })

  it('워크스페이스 조회 실패를 표시하고 다시 시도한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    const refetch = vi.fn()
    mockUseWorkspaces.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    expect(
      screen.getByText('워크스페이스를 불러오지 못했어요'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('알 수 없는 workspace ID에서는 접근 권한 없음 화면을 표시하고 프로젝트 query를 호출하지 않는다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })
    const onWorkspaceChange = vi.fn()

    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <HomePage
          workspaceId="workspace-does-not-exist"
          onWorkspaceChange={onWorkspaceChange}
        />
      </QueryClientProvider>,
    )

    expect(
      screen.getByRole('heading', {
        name: '존재하지 않는 워크스페이스예요',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('project-list-content')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'My Workspace로 돌아가기' }),
    )
    expect(onWorkspaceChange).toHaveBeenCalledWith('workspace-1')
  })

  it('워크스페이스가 없어도 빈 목록과 생성 진입점을 표시한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    mockUseWorkspaces.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    await userEvent.click(
      screen.getByRole('button', { name: '워크스페이스 선택' }),
    )

    expect(screen.getByText('워크스페이스가 없습니다')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    ).toBeInTheDocument()
  })

  it('목록에서 현재 선택이 사라지면 기본 워크스페이스로 보정한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    let workspaces = [otherWorkspaceFixture, workspaceFixture]
    mockUseWorkspaces.mockImplementation(() => ({
      data: workspaces,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }))
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    const { rerenderHomePage } = renderHomePage()

    await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
    await userEvent.click(screen.getByRole('option', { name: /다른 팀/ }))
    expect(screen.getByRole('button', { name: '다른 팀' })).toBeInTheDocument()

    workspaces = [workspaceFixture]
    rerenderHomePage()

    expect(
      screen.getByRole('button', { name: 'My Workspace' }),
    ).toBeInTheDocument()
    workspaces = [otherWorkspaceFixture, workspaceFixture]
    rerenderHomePage()

    expect(
      screen.getByRole('button', { name: 'My Workspace' }),
    ).toBeInTheDocument()
  })

  it('워크스페이스를 불러와 사이드바에 표시하고 생성 후에도 현재 워크스페이스를 유지한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    const mutateAsync = vi.fn().mockResolvedValue(createdWorkspaceFixture)
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    expect(
      await screen.findByRole('button', { name: 'My Workspace' }),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
    await userEvent.click(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    )
    await userEvent.type(screen.getByLabelText('이름'), '새 팀')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'My Workspace' }),
      ).toBeInTheDocument(),
    )
    expect(mutateAsync).toHaveBeenCalledWith('새 팀')
    expect(toast.success).toHaveBeenCalledWith('워크스페이스를 만들었어요')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(screen.getByRole('option', { name: /새 팀/ })).toBeInTheDocument()
  })

  it('생성 다이얼로그 외부를 눌러도 워크스페이스 목록을 유지한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    renderHomePage()

    await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
    await userEvent.click(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    )

    fireEvent.pointerDown(
      document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(
      document.querySelector('[data-slot="workspace-switcher-popover"]'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '취소' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('생성 직후 임시 항목을 표시하고 새 API 목록으로 교체한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    let workspaces = [workspaceFixture]
    const mutateAsync = vi.fn().mockResolvedValue(createdWorkspaceFixture)
    mockUseWorkspaces.mockImplementation(() => ({
      data: workspaces,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }))
    mockUseCreateWorkspace.mockReturnValue({
      mutateAsync,
      isPending: false,
      error: null,
      reset: vi.fn(),
    })

    const { rerenderHomePage } = renderHomePage()

    await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
    await userEvent.click(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    )
    await userEvent.type(screen.getByLabelText('이름'), '새 팀')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(
      await screen.findByRole('button', { name: 'My Workspace' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /새 팀/ })).toBeInTheDocument()

    workspaces = [workspaceFixture]
    rerenderHomePage()

    expect(
      screen.getByRole('button', { name: 'My Workspace' }),
    ).toBeInTheDocument()
  })

  it('생성 실패를 표시하고 닫은 뒤 다시 열면 오류를 초기화한다', async () => {
    useSessionStore.getState().setSession('token-1', userFixture)
    let mutationError: Error | null = null
    const mutateAsync = vi.fn().mockImplementation(async () => {
      mutationError = new Error('Internal Server Error')
      throw mutationError
    })
    const reset = vi.fn(() => {
      mutationError = null
    })
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    mockUseCreateWorkspace.mockImplementation(() => ({
      mutateAsync,
      isPending: false,
      error: mutationError,
      reset,
    }))

    const { rerenderHomePage } = renderHomePage()

    await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
    await userEvent.click(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    )
    await userEvent.type(screen.getByLabelText('이름'), '실패할 팀')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))
    rerenderHomePage()

    expect(screen.getByRole('alert')).toHaveTextContent(
      '워크스페이스를 만들지 못했어요',
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(reset).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
