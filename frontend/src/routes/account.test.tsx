import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import { routeTree } from '@/routeTree.gen'

import { redirectIfUnauthenticated } from './index'
import { ACCOUNT_ROUTE, Route } from './account'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('@/pages/account', () => ({
  AccountPage: ({
    workspaceId,
    onNavChange,
    onWorkspaceChange,
  }: {
    workspaceId?: string
    onNavChange?: (key: 'projects', workspaceId: string | null) => void
    onWorkspaceChange?: (workspaceId: string) => void
  }) => (
    <div data-testid="account-page" data-workspace-id={workspaceId}>
      <button
        type="button"
        onClick={() => onNavChange?.('projects', 'workspace-current')}
      >
        프로젝트 메뉴
      </button>
      <button
        type="button"
        onClick={() => onNavChange?.('projects', 'workspace-row')}
      >
        워크스페이스 행
      </button>
      <button
        type="button"
        onClick={() => onWorkspaceChange?.('workspace-next')}
      >
        워크스페이스 전환
      </button>
    </div>
  ),
}))

describe('account route', () => {
  function createToken(exp: number) {
    const encode = (value: unknown) =>
      btoa(JSON.stringify(value))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replace(/=+$/, '')

    return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
  }

  beforeEach(() => {
    mockNavigate.mockReset()
    useSessionStore.getState().clearSession()
  })

  afterEach(() => {
    useSessionStore.getState().clearSession()
  })

  it('account route는 /account와 기존 auth guard를 사용한다', () => {
    expect(ACCOUNT_ROUTE).toBe('/account')
    expect(Route.options.beforeLoad).toBe(redirectIfUnauthenticated)
  })

  it('workspaceId가 문자열일 때만 search에 보존한다', () => {
    const validateSearch = Route.options.validateSearch as (
      search: Record<string, unknown>,
    ) => { workspaceId?: string }

    expect(validateSearch({ workspaceId: 'workspace-1' })).toEqual({
      workspaceId: 'workspace-1',
    })
    expect(validateSearch({ workspaceId: 123 })).toEqual({})
  })

  it('계정의 프로젝트 메뉴와 workspace 행은 선택 workspace의 project route로 이동한다', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
      id: 'user-1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/account?workspaceId=workspace-current'],
      }),
    })

    render(<RouterProvider router={router} />)

    expect(await screen.findByTestId('account-page')).toHaveAttribute(
      'data-workspace-id',
      'workspace-current',
    )

    await userEvent.click(screen.getByRole('button', { name: '프로젝트 메뉴' }))
    await userEvent.click(
      screen.getByRole('button', { name: '워크스페이스 행' }),
    )

    expect(mockNavigate).toHaveBeenNthCalledWith(1, {
      to: '/workspaces/$workspaceId/projects',
      params: { workspaceId: 'workspace-current' },
    })
    expect(mockNavigate).toHaveBeenNthCalledWith(2, {
      to: '/workspaces/$workspaceId/projects',
      params: { workspaceId: 'workspace-row' },
    })
  })

  it('workspace switcher는 account route의 workspace search만 replace한다', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
      id: 'user-1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/account'] }),
    })

    render(<RouterProvider router={router} />)

    await userEvent.click(
      await screen.findByRole('button', { name: '워크스페이스 전환' }),
    )

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/account',
      search: { workspaceId: 'workspace-next' },
      replace: true,
    })
  })
})
