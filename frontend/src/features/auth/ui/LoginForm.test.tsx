import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { axiosInstance } from '@/shared/api'
import { useSessionStore } from '@/entities/session'

import { LoginForm } from './LoginForm'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
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

describe('LoginForm', () => {
  beforeEach(() => {
    vi.mocked(axiosInstance.post).mockReset()
    navigateMock.mockReset()
    useSessionStore.getState().clearSession()
  })

  it('renders the email/password fields and submit button', () => {
    renderLoginForm()

    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('shows client validation errors and does not call the API on empty submit', async () => {
    renderLoginForm()

    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByText('이메일을 입력해주세요')).toBeInTheDocument()
    expect(screen.getByText('비밀번호를 입력해주세요')).toBeInTheDocument()
    expect(axiosInstance.post).not.toHaveBeenCalled()
  })

  it('shows an email format error for an invalid address', async () => {
    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByText('올바른 이메일 형식이 아닙니다'),
    ).toBeInTheDocument()
    expect(axiosInstance.post).not.toHaveBeenCalled()
  })

  it('stores the session and navigates to / on success', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: {
        accessToken: 'token-1',
        user: { id: '1', name: '테스터', email: 'user@in2white.team' },
      },
    })

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'user@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: '/' }))
    expect(useSessionStore.getState().accessToken).toBe('token-1')
  })

  it('shows the server error message on 401 and does not navigate', async () => {
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

    await userEvent.type(screen.getByLabelText('이메일'), 'user@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByText('이메일 또는 비밀번호가 올바르지 않습니다'),
    ).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(useSessionStore.getState().accessToken).toBeNull()
  })

  it('shows the fallback message when the request fails with no response', async () => {
    vi.mocked(axiosInstance.post).mockRejectedValueOnce({
      isAxiosError: true,
      response: undefined,
    })

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'user@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByText(
        '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
      ),
    ).toBeInTheDocument()
  })

  it('disables the submit button while the request is pending', async () => {
    let resolveRequest: (value: unknown) => void = () => {}
    vi.mocked(axiosInstance.post).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )

    renderLoginForm()

    await userEvent.type(screen.getByLabelText('이메일'), 'user@in2white.team')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: '로그인' }))

    // 로딩 중에는 라벨이 "로그인 중..."으로 바뀌므로(§5 — 아이콘만 남기면 접근 가능한
    // 이름이 사라진다) name 필터 없이 폼의 유일한 버튼을 조회한다.
    const pendingButton = screen.getByRole('button')
    expect(pendingButton).toBeDisabled()
    expect(pendingButton).toHaveTextContent('로그인 중...')

    resolveRequest({
      data: {
        accessToken: 'token-1',
        user: { id: '1', name: '테스터', email: 'a@a.com' },
      },
    })
  })
})
