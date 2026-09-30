import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { axiosInstance } from '@/shared/api'
import { useAdminSessionStore } from '@/entities/admin-session'

import { AdminAppShell } from './AdminAppShell'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: PropsWithChildren<{ to: string }>) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
}))

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
}))

function renderAppShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <AdminAppShell>
        <p>본문</p>
      </AdminAppShell>
    </QueryClientProvider>,
  )
}

describe('AdminAppShell', () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.post).mockReset()
    navigateMock.mockReset()
    useAdminSessionStore.getState().setSession('admin-token-1', {
      id: 'admin-1',
      email: 'admin@in2white.team',
    })
  })

  afterEach(() => {
    useAdminSessionStore.getState().clearSession()
  })

  it('사이드바 메뉴와 환경 배지, 로그인한 어드민을 보여준다', () => {
    renderAppShell()

    expect(
      screen.getByRole('navigation', { name: '어드민 사이드바' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '대시보드' })).toBeInTheDocument()
    expect(screen.getByLabelText('현재 환경: local')).toBeInTheDocument()
    expect(screen.getByText('admin@in2white.team')).toBeInTheDocument()
  })

  it('로그아웃하면 세션을 비우고 /login으로 이동한다', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: undefined })

    renderAppShell()

    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/login',
        replace: true,
      }),
    )
    expect(axiosInstance.post).toHaveBeenCalledWith('/auth/logout')
    expect(useAdminSessionStore.getState()).toMatchObject({
      accessToken: null,
      admin: null,
    })
  })

  /* 서버 호출이 실패해도 화면에 로그인 상태가 남으면 안 된다. */
  it('로그아웃 요청이 실패해도 세션을 비운다', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce(new Error('500'))

    renderAppShell()

    await userEvent.click(screen.getByRole('button', { name: '로그아웃' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({
        to: '/login',
        replace: true,
      }),
    )
    expect(useAdminSessionStore.getState().accessToken).toBeNull()
  })
})
