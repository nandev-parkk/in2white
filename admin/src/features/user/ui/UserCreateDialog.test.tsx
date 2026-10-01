import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { UserCreateDialog } from './UserCreateDialog'

function renderDialog(onSubmit = vi.fn()) {
  render(<UserCreateDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />)

  return { onSubmit }
}

describe('UserCreateDialog', () => {
  it('이메일·이름·비밀번호 입력을 보여준다', () => {
    renderDialog()

    expect(screen.getByLabelText('이메일')).toBeInTheDocument()
    expect(screen.getByLabelText('이름')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
  })

  it('빈 제출은 오류를 보여주고 생성을 요청하지 않는다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.click(screen.getByRole('button', { name: '사용자 추가' }))

    expect(await screen.findByText('이메일을 입력해주세요')).toBeInTheDocument()
    expect(screen.getByText('이름을 입력해주세요')).toBeInTheDocument()
    expect(screen.getByText('비밀번호를 입력해주세요')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  /* 제품과 같은 비밀번호 규칙을 쓴다 — 어드민이 만든 계정만 약한 비밀번호를 갖게 되면 안 된다. */
  it('규칙에 맞지 않는 비밀번호는 오류를 보여준다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.type(screen.getByLabelText('이메일'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('이름'), '새 사용자')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'password')
    await userEvent.click(screen.getByRole('button', { name: '사용자 추가' }))

    expect(
      await screen.findByText('비밀번호는 숫자를 포함해야 합니다'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('입력이 유효하면 생성 값을 넘긴다', async () => {
    const { onSubmit } = renderDialog()

    await userEvent.type(screen.getByLabelText('이메일'), 'new@example.com')
    await userEvent.type(screen.getByLabelText('이름'), '새 사용자')
    await userEvent.type(screen.getByLabelText('비밀번호'), 'Password1!')
    await userEvent.click(screen.getByRole('button', { name: '사용자 추가' }))

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'new@example.com',
      name: '새 사용자',
      password: 'Password1!',
    })
  })
})
