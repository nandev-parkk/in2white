import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Search } from './search'

describe('Search', () => {
  it('커스텀 clear 버튼을 제공하고 네이티브 search 입력을 사용하지 않는다', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()

    render(<Search value="alpha" onChange={() => {}} onClear={onClear} />)

    expect(screen.getByRole('searchbox')).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: '검색어 지우기' }))

    expect(onClear).toHaveBeenCalledOnce()
  })

  it('검색어가 없으면 clear 버튼을 표시하지 않는다', () => {
    render(<Search value="" onChange={() => {}} onClear={vi.fn()} />)

    expect(
      screen.queryByRole('button', { name: '검색어 지우기' }),
    ).not.toBeInTheDocument()
  })
})
