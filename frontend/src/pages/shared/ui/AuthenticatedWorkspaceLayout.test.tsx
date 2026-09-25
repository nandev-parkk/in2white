import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'

import { AuthenticatedWorkspaceLayout } from './AuthenticatedWorkspaceLayout'
import { DelayedLoading } from '@/shared/ui/loading-state'

const userFixture = {
  id: 'user-1',
  name: '테스터',
  email: 'user@in2white.team',
}

const defaultWorkspaceFixture: WorkspaceSummary = {
  id: 'workspace-default',
  name: '기본 워크스페이스',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const workspaceFixture: WorkspaceSummary = {
  ...defaultWorkspaceFixture,
  id: 'workspace-1',
  name: '프로젝트 워크스페이스',
  isDefault: false,
}

const mockUseWorkspaces = vi.fn()
const mockUseCreateWorkspace = vi.fn()
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/features/auth/api/session', () => ({
  logoutRequest: vi.fn(),
}))

vi.mock('@/features/workspace', () => ({
  useWorkspaces: (...args: unknown[]) => mockUseWorkspaces(...args),
  useCreateWorkspace: (...args: unknown[]) => mockUseCreateWorkspace(...args),
}))

function renderLayout(children: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      {children}
    </QueryClientProvider>,
  )
}

describe('AuthenticatedWorkspaceLayout', () => {
  afterEach(() => vi.useRealTimers())
  beforeEach(() => {
    mockNavigate.mockReset()
    useSessionStore.getState().clearSession()
    useSessionStore.getState().setSession('token-1', userFixture)
    mockUseWorkspaces.mockReset()
    mockUseCreateWorkspace.mockReset()
    mockUseWorkspaces.mockReturnValue({
      data: [defaultWorkspaceFixture, workspaceFixture],
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
  })

  it('워크스페이스와 자식은 대기 시간을 공유하고 새 경로에서는 다시 지연한다', () => {
    vi.useFakeTimers()
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const page = (workspaceId: string) => (
      <QueryClientProvider client={client}>
        <AuthenticatedWorkspaceLayout workspaceId={workspaceId}>
          {({ loadingStartedAt }) => (
            <DelayedLoading startedAt={loadingStartedAt}>
              <div role="status" aria-label="목록 로딩" />
            </DelayedLoading>
          )}
        </AuthenticatedWorkspaceLayout>
      </QueryClientProvider>
    )
    mockUseWorkspaces.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    })
    const { rerender } = render(page('workspace-1'))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(
      document.querySelectorAll('[data-slot="resource-card-skeleton"]'),
    ).toHaveLength(6)
    act(() => vi.advanceTimersByTime(350))
    expect(
      screen.getByRole('status', { name: '워크스페이스를 불러오는 중' }),
    ).toBeVisible()
    mockUseWorkspaces.mockReturnValue({
      data: [workspaceFixture, defaultWorkspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    rerender(page('workspace-1'))
    expect(screen.getByRole('status', { name: '목록 로딩' })).toBeVisible()
    rerender(page('workspace-default'))
    expect(
      screen.queryByRole('status', { name: '목록 로딩' }),
    ).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByRole('status', { name: '목록 로딩' })).toBeVisible()
    client.clear()
  })

  it('fallback 모드에서는 알 수 없는 ID에도 기본 workspace를 선택한다', () => {
    renderLayout(
      <AuthenticatedWorkspaceLayout
        workspaceId="workspace-unknown"
        unknownWorkspace="fallback"
        activeNav="settings"
      >
        {({ selectedWorkspace }) => <span>{selectedWorkspace?.id}</span>}
      </AuthenticatedWorkspaceLayout>,
    )

    expect(screen.getByText('workspace-default')).toBeInTheDocument()
  })

  it('일반 navigation callback에 선택 workspace ID를 전달한다', async () => {
    const onNavChange = vi.fn()

    renderLayout(
      <AuthenticatedWorkspaceLayout
        workspaceId="workspace-1"
        activeNav="projects"
        onNavChange={onNavChange}
      >
        {() => null}
      </AuthenticatedWorkspaceLayout>,
    )

    await userEvent.click(screen.getByRole('button', { name: '프로젝트' }))

    expect(onNavChange).toHaveBeenCalledWith('projects', 'workspace-1')
  })

  it('화면 callback이 있으면 설정 navigation을 선택 workspace ID와 함께 위임한다', async () => {
    const onNavChange = vi.fn()

    renderLayout(
      <AuthenticatedWorkspaceLayout
        workspaceId="workspace-1"
        activeNav="projects"
        onNavChange={onNavChange}
      >
        {() => null}
      </AuthenticatedWorkspaceLayout>,
    )

    await userEvent.click(screen.getByRole('button', { name: '설정' }))

    expect(onNavChange).toHaveBeenCalledWith('settings', 'workspace-1')
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('화면 callback이 없는 경우에도 설정 메뉴는 선택 workspace로 이동한다', async () => {
    renderLayout(
      <AuthenticatedWorkspaceLayout workspaceId="workspace-1" activeNav="projects">
        {() => null}
      </AuthenticatedWorkspaceLayout>,
    )

    await userEvent.click(screen.getByRole('button', { name: '설정' }))

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/workspaces/$workspaceId/settings',
      params: { workspaceId: 'workspace-1' },
    })
  })

  it('사용자 정보 callback에 선택 workspace ID를 전달한다', async () => {
    const onUserClick = vi.fn()

    renderLayout(
      <AuthenticatedWorkspaceLayout
        workspaceId="workspace-1"
        activeNav="projects"
        onUserClick={onUserClick}
      >
        {() => null}
      </AuthenticatedWorkspaceLayout>,
    )

    await userEvent.click(screen.getByRole('button', { name: /사용자 정보/ }))

    expect(onUserClick).toHaveBeenCalledWith('workspace-1')
  })

  it('activeNav가 null이면 어떤 사이드바 항목도 활성화하지 않는다', () => {
    renderLayout(
      <AuthenticatedWorkspaceLayout
        workspaceId="workspace-1"
        activeNav={null}
        workspaceMode="optional"
      >
        {() => null}
      </AuthenticatedWorkspaceLayout>,
    )

    for (const label of ['프로젝트', '멤버', '설정']) {
      expect(screen.getByRole('button', { name: label })).not.toHaveClass(
        'bg-action-secondary',
      )
    }
  })

  it('activeNav를 지정하면 해당 사이드바 항목만 활성화한다', () => {
    renderLayout(
      <AuthenticatedWorkspaceLayout
        workspaceId="workspace-1"
        activeNav="settings"
      >
        {() => null}
      </AuthenticatedWorkspaceLayout>,
    )

    expect(screen.getByRole('button', { name: '설정' })).toHaveClass(
      'bg-action-secondary',
    )
    expect(screen.getByRole('button', { name: '프로젝트' })).not.toHaveClass(
      'bg-action-secondary',
    )
  })

  it('기본 워크스페이스에서는 사이드바 멤버 초대 진입점을 제공하지 않는다', () => {
    renderLayout(
      <AuthenticatedWorkspaceLayout
        workspaceId="workspace-default"
        activeNav="members"
      >
        {() => null}
      </AuthenticatedWorkspaceLayout>,
    )

    expect(
      screen.queryByRole('button', { name: '멤버 초대' }),
    ).not.toBeInTheDocument()
  })

  it('일반 워크스페이스 소유자에게는 사이드바 멤버 초대 진입점을 제공한다', () => {
    renderLayout(
      <AuthenticatedWorkspaceLayout
        workspaceId="workspace-1"
        activeNav="members"
      >
        {() => null}
      </AuthenticatedWorkspaceLayout>,
    )

    expect(
      screen.getByRole('button', { name: '멤버 초대' }),
    ).toBeInTheDocument()
  })

  it('optional 모드에서는 workspace query loading 중에도 children을 렌더링한다', () => {
    mockUseWorkspaces.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    })

    renderLayout(
      <AuthenticatedWorkspaceLayout workspaceMode="optional">
        {() => <span>계정 설정 콘텐츠</span>}
      </AuthenticatedWorkspaceLayout>,
    )

    expect(screen.getByText('계정 설정 콘텐츠')).toBeInTheDocument()
  })

  it('optional 모드에서는 workspace query error가 children을 막지 않고 재시도를 제공한다', async () => {
    const refetch = vi.fn()
    mockUseWorkspaces.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    })

    renderLayout(
      <AuthenticatedWorkspaceLayout workspaceMode="optional">
        {({ workspaceError, refetchWorkspaces }) => (
          <>
            <span>계정 설정 콘텐츠</span>
            {workspaceError && (
              <button onClick={() => void refetchWorkspaces()} type="button">
                워크스페이스 재시도
              </button>
            )}
          </>
        )}
      </AuthenticatedWorkspaceLayout>,
    )

    expect(screen.getByText('계정 설정 콘텐츠')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: '워크스페이스 재시도' }),
    )
    expect(refetch).toHaveBeenCalledOnce()
  })
})
