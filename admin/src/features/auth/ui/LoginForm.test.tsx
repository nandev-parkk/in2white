import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { axiosInstance } from '@/shared/api'
import { useAdminSessionStore } from '@/entities/admin-session'
import { toast } from '@in2white/ui/toast'

import { LoginForm } from './LoginForm'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
}))

vi.mock('@in2white/ui/toast', () => ({
  toast: { error: vi.fn() },
}))

function renderLoginForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  )
}

describe('어드민 LoginForm', () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.post).mockReset()
    vi.mocked(toast.error).mockReset()
    navigateMock.mockReset()
    useAdminSessionStore.getState().clearSession()
  })

  it('이메일·비밀번호 입력과 제출 버튼을 렌더링한다', () => {
    renderLoginForm()

    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('빈 제출은 API를 호출하지 않고 검증 오류를 보여준다', async () => {
    renderLoginForm()

    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('이메일을 입력해주세요')).toBeInTheDocument()
    expect(screen.getByText('비밀번호를 입력해주세요')).toBeInTheDocument()
    expect(axiosInstance.post).not.toHaveBeenCalled()
  })

  it('로그인에 성공하면 세션을 저장하고 /로 이동한다', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: {
        accessToken: 'admin-token-1',
        admin: { id: 'admin-1', email: 'admin@in2white.team' },
      },
    })

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'admin@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'Password123!')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith({ to: '/', replace: true }),
    )
    expect(useAdminSessionStore.getState().accessToken).toBe('admin-token-1')
  })

  it('401이면 서버 메시지를 토스트로 알리고 이동하지 않는다', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          error: {
            message: '이메일 또는 비밀번호가 올바르지 않습니다',
            code: 'INVALID_CREDENTIALS',
          },
        },
      },
    })

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'admin@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'Wrong123!')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '이메일 또는 비밀번호가 올바르지 않습니다',
      ),
    )
    expect(navigateMock).not.toHaveBeenCalled()
    expect(useAdminSessionStore.getState().accessToken).toBeNull()
  })
})
