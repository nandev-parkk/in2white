import { render, screen } from '@testing-library/react'

import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('renders the start button', () => {
    render(<HomePage />)

    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument()
  })
})
