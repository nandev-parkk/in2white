import { render, screen } from '@testing-library/react'

import { Button } from './button'

describe('Button', () => {
  it('keeps the label centered when a loading icon is shown', () => {
    render(<Button loading>로그인</Button>)

    const button = screen.getByRole('button', { name: '로그인' })
    const content = button.querySelector('[data-slot="button-content"]')
    const label = button.querySelector('[data-slot="button-label"]')
    const loadingIcon = button.querySelector('[data-slot="button-loading"]')

    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toBeDisabled()
    expect(content?.contains(label)).toBe(true)
    expect(loadingIcon).toHaveClass('absolute', 'right-full')
    expect(label).toHaveTextContent('로그인')
  })

  it('preserves the child element when rendered with asChild', () => {
    render(
      <Button asChild>
        <a href="/home">홈</a>
      </Button>,
    )

    const link = screen.getByRole('link', { name: '홈' })

    expect(link).toHaveAttribute('data-slot', 'button')
  })
})
