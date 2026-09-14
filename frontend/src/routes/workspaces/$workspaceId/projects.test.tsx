import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import { routeTree } from '@/routeTree.gen'

import { redirectIfUnauthenticated } from '../../index'
import { PROJECTS_ROUTE, Route } from './projects'

const homePageInstance = vi.hoisted(() => ({ nextId: 0 }))

vi.mock('@/pages/home', () => ({
  HomePage: ({
    workspaceId,
    onNavChange,
    onUserClick,
    onWorkspaceChange,
  }: {
    workspaceId?: string
    onNavChange?: (key: 'settings', workspaceId: string | null) => void
    onUserClick?: (workspaceId: string | null) => void
    onWorkspaceChange?: (workspaceId: string) => void
  }) => {
    const [instanceId] = useState(() => ++homePageInstance.nextId)

    return (
      <div
        data-testid="workspace-projects-route"
        data-workspace-id={workspaceId}
        data-instance-id={instanceId}
      >
        <button
          type="button"
          onClick={() => onWorkspaceChange?.('workspace-next')}
        >
          다른 워크스페이스
        </button>
        <button
          type="button"
          onClick={() => onNavChange?.('settings', 'workspace-current')}
        >
          설정
        </button>
        <button
          type="button"
          onClick={() => onUserClick?.('workspace-current')}
        >
          사용자 정보
        </button>
      </div>
    )
  },
}))

vi.mock('@/pages/account', () => ({
  AccountPage: () => <div data-testid="account-route" />,
}))

describe('project route', () => {
  function createToken(exp: number) {
    const encode = (value: unknown) =>
      btoa(JSON.stringify(value))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '')

    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
  }

  afterEach(() => {
    useSessionStore.getState().clearSession()
    homePageInstance.nextId = 0
  })

  it('canonical project route는 복수형 resource 경로를 사용한다', () => {
    expect(PROJECTS_ROUTE).toBe('/workspaces/$workspaceId/projects')
  })

  it('인증되지 않은 접근을 로그인 route로 보호한다', async () => {
    expect(Route.options.beforeLoad).toBe(redirectIfUnauthenticated)
    await expect(Route.options.beforeLoad?.({} as never)).rejects.toMatchObject(
      {
        options: { to: '/login' },
      },
    )
  })

  it('인증된 접근은 project route에 머문다', () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
      id: 'user-1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    expect(() => Route.options.beforeLoad?.({} as never)).not.toThrow()
  })

  it('URL workspace ID를 페이지에 전달하고 workspace 변경도 project route로 이동한다', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
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
    const initialInstanceId = screen
      .getByTestId('workspace-projects-route')
      .getAttribute('data-instance-id')

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
    expect(screen.getByTestId('workspace-projects-route')).toHaveAttribute(
      'data-instance-id',
      initialInstanceId,
    )
  })

  it('사이드바 하단 사용자 정보는 현재 workspace context를 보존한 account route로 이동한다', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
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

    await userEvent.click(
      await screen.findByRole('button', { name: '사용자 정보' }),
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/account'))
    expect(router.state.location.search).toEqual({
      workspaceId: 'workspace-current',
    })
  })

  it('사이드바 설정은 account route로 이동하지 않는다', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
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

    await userEvent.click(await screen.findByRole('button', { name: '설정' }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(router.state.location.pathname).toBe(
      '/workspaces/workspace-current/projects',
    )
  })
})
