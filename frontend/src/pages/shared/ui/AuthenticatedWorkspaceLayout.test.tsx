import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'

import { AuthenticatedWorkspaceLayout } from './AuthenticatedWorkspaceLayout'

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

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
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
  beforeEach(() => {
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

  it('navigation callback에 선택 workspace ID를 전달한다', async () => {
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
