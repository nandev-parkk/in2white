import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import { routeTree } from '@/routeTree.gen'
import { WorkspaceSettingsPage } from '@/pages/workspace-settings'

import { redirectIfUnauthenticated } from '../../index'
import { Route, SETTINGS_ROUTE } from './settings'

type SettingsRoutePageProps = {
  workspaceId: string
  onWorkspaceChange: (workspaceId: string) => void
  onNavChange: (
    key: 'projects' | 'members' | 'settings',
    workspaceId: string | null,
  ) => void
  onUserClick: (workspaceId: string | null) => void
  onDeleted: () => void
  onReturn: () => void
}

vi.mock('@/pages/workspace-settings', () => ({
  WorkspaceSettingsPage: vi.fn(),
}))
vi.mock('@/pages/account', () => ({
  AccountPage: () => <div data-testid="account-route" />,
}))
vi.mock('@/pages/home', () => ({
  HomePage: () => <div data-testid="home-route" />,
}))
vi.mock('@/pages/workspace-redirect', () => ({
  WorkspaceRedirectPage: () => <div data-testid="root-workspace-redirect" />,
}))

function createToken(exp: number) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
}

function mountSettings(path = '/workspaces/workspace-current/settings') {
  useSessionStore.getState().setSession(createToken(2_000_000_000), {
    id: 'user-1',
    name: '테스터',
    email: 'user@in2white.team',
  })
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  vi.mocked(WorkspaceSettingsPage).mockImplementation(
    ({
      workspaceId,
      onWorkspaceChange,
      onNavChange,
      onUserClick,
      onDeleted,
      onReturn,
    }: SettingsRoutePageProps) => (
      <div data-testid="settings-route" data-workspace-id={workspaceId}>
        <button onClick={() => onWorkspaceChange('workspace-next')}>
          다른 워크스페이스
        </button>
        <button onClick={() => onNavChange('projects', workspaceId)}>
          프로젝트
        </button>
        <button onClick={() => onNavChange('members', workspaceId)}>
          멤버
        </button>
        <button onClick={() => onNavChange('settings', 'workspace-next')}>
          설정
        </button>
        <button onClick={() => onNavChange('settings', null)}>
          workspace 없음
        </button>
        <button onClick={() => onUserClick(workspaceId)}>사용자 정보</button>
        <button onClick={onDeleted}>삭제 완료</button>
        <button onClick={onReturn}>돌아가기</button>
      </div>
    ),
  )

  render(<RouterProvider router={router} />)
  return router
}

describe('workspace settings route', () => {
  afterEach(() => useSessionStore.getState().clearSession())

  it('canonical path와 인증 guard를 사용한다', async () => {
    expect(SETTINGS_ROUTE).toBe('/workspaces/$workspaceId/settings')
    expect(Route.options.beforeLoad).toBe(redirectIfUnauthenticated)
    await expect(Route.options.beforeLoad?.({} as never)).rejects.toMatchObject({
      options: { to: '/login' },
    })
  })

  it('URL workspace ID를 설정 페이지에 전달한다', async () => {
    mountSettings()

    expect(await screen.findByTestId('settings-route')).toHaveAttribute(
      'data-workspace-id',
      'workspace-current',
    )
  })

  it('workspace 변경 후에도 settings route를 유지한다', async () => {
    const router = mountSettings()
    await userEvent.click(
      await screen.findByRole('button', { name: '다른 워크스페이스' }),
    )

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/workspaces/workspace-next/settings',
      ),
    )
  })

  it('settings의 프로젝트 메뉴는 현재 workspace 프로젝트 route로 이동한다', async () => {
    const projectsRouter = mountSettings()
    await userEvent.click(await screen.findByRole('button', { name: '프로젝트' }))
    await waitFor(() =>
      expect(projectsRouter.state.location.pathname).toBe(
        '/workspaces/workspace-current/projects',
      ),
    )
  })

  it('settings의 멤버 메뉴는 현재 workspace 멤버 route로 이동한다', async () => {
    const membersRouter = mountSettings()
    await userEvent.click(await screen.findByRole('button', { name: '멤버' }))
    await waitFor(() =>
      expect(membersRouter.state.location.pathname).toBe(
        '/workspaces/workspace-current/members',
      ),
    )
  })

  it('settings 메뉴는 선택한 workspace의 settings route로 이동한다', async () => {
    const settingsRouter = mountSettings()
    await userEvent.click(await screen.findByRole('button', { name: '설정' }))
    await waitFor(() =>
      expect(settingsRouter.state.location.pathname).toBe(
        '/workspaces/workspace-next/settings',
      ),
    )
  })

  it('workspace ID가 없으면 navigation을 실행하지 않는다', async () => {
    const router = mountSettings()
    await userEvent.click(
      await screen.findByRole('button', { name: 'workspace 없음' }),
    )

    expect(router.state.location.pathname).toBe(
      '/workspaces/workspace-current/settings',
    )
  })

  it('사용자 정보는 현재 workspace ID를 account route에 전달한다', async () => {
    const router = mountSettings()
    await userEvent.click(
      await screen.findByRole('button', { name: '사용자 정보' }),
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/account'))
    expect(router.state.location.search).toEqual({
      workspaceId: 'workspace-current',
    })
  })

  it('권한 거부 화면의 돌아가기는 같은 workspace 프로젝트 route를 연다', async () => {
    const router = mountSettings()
    await userEvent.click(await screen.findByRole('button', { name: '돌아가기' }))

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/workspaces/workspace-current/projects',
      ),
    )
  })

  it('삭제 성공 후 root route로 이동한다', async () => {
    const router = mountSettings()
    await userEvent.click(await screen.findByRole('button', { name: '삭제 완료' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })
})
