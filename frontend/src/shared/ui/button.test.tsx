import { render, screen } from '@testing-library/react'

import { Button } from './button'

describe('Button', () => {
  it('renders the "lg" size as a 44px control with a 12px radius', () => {
    render(<Button size="lg">로그인</Button>)

    const button = screen.getByRole('button', { name: '로그인' })

    expect(button.className).toContain('h-11')
    expect(button.className).toContain('rounded-lg')
  })

  it('renders the default size with an 8px radius, unaffected by the lg fix', () => {
    render(<Button>시작하기</Button>)

    const button = screen.getByRole('button', { name: '시작하기' })

    expect(button.className).toContain('rounded-md')
  })
})
