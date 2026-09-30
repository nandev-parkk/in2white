import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ListPagination } from './list-pagination'

describe('ListPagination', () => {
  it('페이지가 하나면 렌더링하지 않는다', () => {
    const { container } = render(
      <ListPagination page={1} totalPages={1} onPageChange={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('첫 페이지에서는 이전 버튼이 비활성이다', () => {
    render(<ListPagination page={1} totalPages={3} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeEnabled()
  })

  it('마지막 페이지에서는 다음 버튼이 비활성이다', () => {
    render(<ListPagination page={3} totalPages={3} onPageChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeDisabled()
  })

  it('페이지 번호를 누르면 해당 페이지를 전달한다', async () => {
    const onPageChange = vi.fn()
    render(
      <ListPagination page={1} totalPages={3} onPageChange={onPageChange} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '2' }))

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('다음 버튼은 현재 페이지의 다음 값을 전달한다', async () => {
    const onPageChange = vi.fn()
    render(
      <ListPagination page={2} totalPages={3} onPageChange={onPageChange} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }))

    expect(onPageChange).toHaveBeenCalledWith(3)
  })
})
