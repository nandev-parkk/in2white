import { render, screen, waitFor } from '@testing-library/react'
import type { SessionUser } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'

import { WorkspaceRedirectPage } from './WorkspaceRedirectPage'

const userFixture: SessionUser = {
  id: 'user-1',
  name: '테스터',
  email: 'user@in2white.team',
}

const defaultWorkspaceFixture: WorkspaceSummary = {
  id: 'workspace-default',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const otherWorkspaceFixture: WorkspaceSummary = {
  ...defaultWorkspaceFixture,
  id: 'workspace-other',
  name: '브랜드 스튜디오',
  isDefault: false,
}

const mockUseWorkspaces = vi.fn()

vi.mock('@/features/workspace', () => ({
  useWorkspaces: (...args: unknown[]) => mockUseWorkspaces(...args),
}))

describe('WorkspaceRedirectPage', () => {
  beforeEach(() => {
    mockUseWorkspaces.mockReset()
  })

  it('인증된 root 진입은 기본 workspace project route로 이동한다', async () => {
    const navigate = vi.fn()
    mockUseWorkspaces.mockReturnValue({
      data: [otherWorkspaceFixture, defaultWorkspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    render(
      <WorkspaceRedirectPage
        accessToken="token-1"
        user={userFixture}
        onNavigate={navigate}
      />,
    )

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('workspace-default'),
    )
    expect(mockUseWorkspaces).toHaveBeenCalledWith('token-1', 'user-1')
  })

  it('workspace 조회 중에는 이동 상태를 표시한다', () => {
    mockUseWorkspaces.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    })

    render(
      <WorkspaceRedirectPage
        accessToken="token-1"
        user={userFixture}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByText('워크스페이스로 이동하는 중')).toBeInTheDocument()
  })

  it('workspace 조회가 실패하면 stale data가 있어도 이동하지 않는다', async () => {
    const navigate = vi.fn()
    mockUseWorkspaces.mockReturnValue({
      data: [defaultWorkspaceFixture],
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    })

    render(
      <WorkspaceRedirectPage
        accessToken="token-1"
        user={userFixture}
        onNavigate={navigate}
      />,
    )

    await waitFor(() => expect(navigate).not.toHaveBeenCalled())
    expect(
      screen.getByText('워크스페이스로 이동하지 못했어요'),
    ).toBeInTheDocument()
  })

  it('기본 workspace가 없으면 첫 workspace로 이동한다', async () => {
    const navigate = vi.fn()
    mockUseWorkspaces.mockReturnValue({
      data: [otherWorkspaceFixture],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    render(
      <WorkspaceRedirectPage
        accessToken="token-1"
        user={userFixture}
        onNavigate={navigate}
      />,
    )

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('workspace-other'),
    )
  })
})
