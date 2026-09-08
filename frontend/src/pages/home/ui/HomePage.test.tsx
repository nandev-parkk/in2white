import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'

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

vi.mock('@/features/workspace', () => ({
  useWorkspaces: (...args: unknown[]) => mockUseWorkspaces(...args),
  useCreateWorkspace: (...args: unknown[]) => mockUseCreateWorkspace(...args),
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
  })

  it('세션이 없으면 워크스페이스 훅을 실행하지 않고 안전 상태를 표시한다', () => {
    renderHomePage()

    expect(screen.getByText('로그인이 필요해요')).toBeInTheDocument()
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

  it('로그아웃을 선택하면 세션을 비우고 로그인 안내를 표시한다', async () => {
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

    expect(screen.getByText('로그인이 필요해요')).toBeInTheDocument()
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
    expect(
      within(screen.getByRole('main')).getByText('My Workspace'),
    ).toBeInTheDocument()

    workspaces = [otherWorkspaceFixture, workspaceFixture]
    rerenderHomePage()

    expect(
      screen.getByRole('button', { name: 'My Workspace' }),
    ).toBeInTheDocument()
  })

  it('워크스페이스를 불러와 사이드바에 표시하고 생성한 워크스페이스를 선택한다', async () => {
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
      expect(screen.getByRole('button', { name: '새 팀' })).toBeInTheDocument(),
    )
    expect(mutateAsync).toHaveBeenCalledWith('새 팀')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
      await screen.findByRole('button', { name: '새 팀' }),
    ).toBeInTheDocument()

    workspaces = [workspaceFixture]
    rerenderHomePage()

    expect(
      screen.getByRole('button', { name: 'My Workspace' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('main')).getByText('My Workspace'),
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

    await userEvent.click(screen.getByRole('button', { name: 'My Workspace' }))
    await userEvent.click(
      screen.getByRole('button', { name: '새 워크스페이스 생성' }),
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
