import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { PasswordInput } from './password-input'

describe('PasswordInput', () => {
  it('starts hidden and toggles password visibility while preserving the value', async () => {
    const user = userEvent.setup()

    render(<PasswordInput aria-label="비밀번호" />)

    const input = screen.getByLabelText('비밀번호')
    await user.type(input, 'password123')

    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveValue('password123')

    await user.click(screen.getByRole('button', { name: '비밀번호 표시' }))

    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('password123')
    expect(
      screen.getByRole('button', { name: '비밀번호 숨기기' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '비밀번호 숨기기' }))

    expect(input).toHaveAttribute('type', 'password')
  })
})
