import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

import { LoginPage } from './LoginPage'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
}))

function renderLoginPage() {
  const queryClient = new QueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginPage />
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('renders the logo, tagline, form, and footer caption', () => {
    renderLoginPage()

    expect(screen.getByText('in2white')).toBeInTheDocument()
    expect(
      screen.getByText('팀의 화이트보드를 함께 그려요.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(
      screen.getByText('계정은 관리자가 미리 만들어 드려요.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        '로그인이 안 되면 워크스페이스 소유자에게 문의해 주세요.',
      ),
    ).toBeInTheDocument()
  })
})
