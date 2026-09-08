import { render, screen } from '@testing-library/react'

import { Input } from './input'

describe('Input', () => {
  it('renders an end adornment without changing the input semantics', () => {
    render(
      <Input
        aria-label="검색"
        endAdornment={<span data-testid="end-adornment">검색 아이콘</span>}
      />,
    )

    expect(screen.getByRole('textbox', { name: '검색' })).toBeInTheDocument()
    expect(screen.getByTestId('end-adornment')).toBeInTheDocument()
  })
})
