import { render, screen } from '@testing-library/react'

import { Input } from './input'

describe('Input', () => {
  it('renders a large text input with the given placeholder', () => {
    render(
      <Input
        size="large"
        placeholder="you@in2white.team"
        aria-label="이메일"
      />,
    )

    const input = screen.getByRole('textbox', { name: '이메일' })

    expect(input).toHaveAttribute('placeholder', 'you@in2white.team')
    expect(input.className).toContain('h-11')
  })

  it('marks itself invalid when aria-invalid is set', () => {
    render(<Input aria-label="이메일" aria-invalid />)

    expect(screen.getByRole('textbox', { name: '이메일' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('is disabled when the disabled prop is set', () => {
    render(<Input aria-label="이메일" disabled />)

    expect(screen.getByRole('textbox', { name: '이메일' })).toBeDisabled()
  })
})
