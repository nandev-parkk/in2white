import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import { routeTree } from '@/routeTree.gen'

import { redirectIfUnauthenticated } from '../../index'
import { PROJECTS_ROUTE, Route } from './projects'

vi.mock('@/pages/home', () => ({
  HomePage: ({
    workspaceId,
    onWorkspaceChange,
  }: {
    workspaceId?: string
    onWorkspaceChange?: (workspaceId: string) => void
  }) => (
    <div data-testid="workspace-projects-route" data-workspace-id={workspaceId}>
      <button
        type="button"
        onClick={() => onWorkspaceChange?.('workspace-next')}
      >
        다른 워크스페이스
      </button>
    </div>
  ),
}))

describe('project route', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
  })

  it('canonical project route는 복수형 resource 경로를 사용한다', () => {
    expect(PROJECTS_ROUTE).toBe('/workspaces/$workspaceId/projects')
  })

  it('인증되지 않은 접근을 로그인 route로 보호한다', () => {
    expect(Route.options.beforeLoad).toBe(redirectIfUnauthenticated)
    expect(() => Route.options.beforeLoad?.({} as never)).toThrow()
  })

  it('인증된 접근은 project route에 머문다', () => {
    useSessionStore.getState().setSession('token-1', {
      id: 'user-1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    expect(() => Route.options.beforeLoad?.({} as never)).not.toThrow()
  })

  it('URL workspace ID를 페이지에 전달하고 workspace 변경도 project route로 이동한다', async () => {
    useSessionStore.getState().setSession('token-1', {
      id: 'user-1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/workspaces/workspace-current/projects'],
      }),
    })

    render(<RouterProvider router={router} />)

    await waitFor(() =>
      expect(screen.getByTestId('workspace-projects-route')).toHaveAttribute(
        'data-workspace-id',
        'workspace-current',
      ),
    )

    await userEvent.click(
      screen.getByRole('button', { name: '다른 워크스페이스' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/workspaces/workspace-next/projects',
      ),
    )
    expect(screen.getByTestId('workspace-projects-route')).toHaveAttribute(
      'data-workspace-id',
      'workspace-next',
    )
  })
})
