import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import { routeTree } from '@/routeTree.gen'

import { redirectIfUnauthenticated } from '../../index'
import { PROJECT_DETAIL_ROUTE, Route } from './projects_.$projectId'

vi.mock('@/pages/project-detail', () => ({
  ProjectDetailPage: (props: Record<string, unknown>) => (
    <div
      data-testid="project-detail-page"
      data-workspace-id={String(props.workspaceId)}
      data-project-id={String(props.projectId)}
    />
  ),
}))

vi.mock('@/pages/home', () => ({
  HomePage: () => <div data-testid="workspace-projects-route" />,
}))

describe('project detail route', () => {
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
  })

  it('경로 상수를 노출한다', () => {
    expect(PROJECT_DETAIL_ROUTE).toBe(
      '/workspaces/$workspaceId/projects/$projectId',
    )
  })

  it('인증되지 않은 접근을 로그인 route로 보호한다', async () => {
    expect(Route.options.beforeLoad).toBe(redirectIfUnauthenticated)
    await expect(Route.options.beforeLoad?.({} as never)).rejects.toMatchObject(
      {
        options: { to: '/login' },
      },
    )
  })

  it('URL의 workspace ID와 project ID를 페이지에 전달한다', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
      id: 'user-1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/workspaces/workspace-1/projects/project-1'],
      }),
    })

    render(<RouterProvider router={router} />)

    await waitFor(() =>
      expect(screen.getByTestId('project-detail-page')).toHaveAttribute(
        'data-workspace-id',
        'workspace-1',
      ),
    )
    expect(screen.getByTestId('project-detail-page')).toHaveAttribute(
      'data-project-id',
      'project-1',
    )
  })
})
