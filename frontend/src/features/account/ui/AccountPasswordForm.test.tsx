import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AccountPasswordForm } from './AccountPasswordForm'

describe('AccountPasswordForm', () => {
  it('각 비밀번호 입력에 용도별 placeholder를 표시한다', () => {
    render(<AccountPasswordForm onSubmit={vi.fn()} loading={false} />)

    expect(
      screen.getByPlaceholderText('현재 비밀번호를 입력해주세요'),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('새 비밀번호를 입력해주세요'),
    ).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('새 비밀번호를 다시 입력해주세요'),
    ).toBeInTheDocument()
  })

  it('label과 input은 6px 간격이고 변경 버튼은 form 우측에 정렬한다', () => {
    render(<AccountPasswordForm onSubmit={vi.fn()} loading={false} />)

    for (const label of ['현재 비밀번호', '새 비밀번호', '새 비밀번호 확인']) {
      expect(screen.getByText(label).parentElement).toHaveClass('gap-[6px]')
    }
    expect(screen.getByRole('button', { name: '변경' })).toHaveClass('self-end')
  })

  it('confirmPassword를 callback payload에 포함하지 않는다', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()

    render(<AccountPasswordForm onSubmit={onSubmit} loading={false} />)

    await user.type(screen.getByLabelText('현재 비밀번호'), 'Old123!')
    await user.type(screen.getByLabelText('새 비밀번호'), 'New12345!')
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'New12345!')
    await user.click(screen.getByRole('button', { name: '변경' }))

    expect(onSubmit).toHaveBeenCalledWith({
      currentPassword: 'Old123!',
      newPassword: 'New12345!',
    })
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('confirmPassword')
  })

  it('확인 비밀번호 불일치 시 callback을 호출하지 않는다', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()

    render(<AccountPasswordForm onSubmit={onSubmit} loading={false} />)

    await user.type(screen.getByLabelText('현재 비밀번호'), 'Old123!')
    await user.type(screen.getByLabelText('새 비밀번호'), 'New12345!')
    await user.type(screen.getByLabelText('새 비밀번호 확인'), 'Different123!')
    await user.click(screen.getByRole('button', { name: '변경' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByText('새 비밀번호가 일치하지 않습니다'),
    ).toBeInTheDocument()
  })

  it('서버 오류를 현재 비밀번호 필드 하단에 표시하고 변경 중 버튼을 비활성화한다', () => {
    render(
      <AccountPasswordForm
        onSubmit={vi.fn()}
        loading
        error="비밀번호를 변경하지 못했어요"
      />,
    )

    const currentPassword = screen.getByLabelText('현재 비밀번호')
    const error = screen.getByRole('alert')

    expect(currentPassword).toHaveAttribute('aria-invalid', 'true')
    expect(currentPassword).toHaveAttribute(
      'aria-describedby',
      'account-currentPassword-error',
    )
    expect(error).toHaveTextContent('비밀번호를 변경하지 못했어요')
    expect(error.parentElement).toBe(
      currentPassword.closest('[data-slot="input-wrapper"]')?.parentElement,
    )
    expect(screen.getByRole('button', { name: '변경' })).toBeDisabled()
  })
})
