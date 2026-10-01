import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ViewToggle } from './view-toggle'

describe('ViewToggle', () => {
  it('현재 보기 방식을 aria-pressed로 알린다', () => {
    render(
      <ViewToggle value="grid" onChange={vi.fn()} label="프로젝트 보기 방식" />,
    )

    expect(
      screen.getByRole('group', { name: '프로젝트 보기 방식' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '카드 보기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('선택 표시가 같은 요소로 유지되며 선택한 보기 쪽으로 이동한다', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <ViewToggle
        value="grid"
        onChange={onChange}
        label="프로젝트 보기 방식"
      />,
    )
    const group = screen.getByRole('group', { name: '프로젝트 보기 방식' })
    const indicator = group.querySelector(':scope > span[aria-hidden="true"]')

    expect(indicator).toHaveClass(
      'bg-background-default',
      'ring-border',
      'shadow-sm',
      'translate-x-0',
      'transition-transform',
      'motion-reduce:transition-none',
    )

    rerender(
      <ViewToggle
        value="table"
        onChange={onChange}
        label="프로젝트 보기 방식"
      />,
    )

    expect(group.querySelector(':scope > span[aria-hidden="true"]')).toBe(
      indicator,
    )
    expect(indicator).toHaveClass('translate-x-[calc(100%+0.125rem)]')
    expect(screen.getByRole('button', { name: '카드 보기' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByRole('button', { name: '목록 보기' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('다른 보기 방식을 누르면 onChange를 호출한다', async () => {
    const onChange = vi.fn()
    render(
      <ViewToggle
        value="grid"
        onChange={onChange}
        label="프로젝트 보기 방식"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '목록 보기' }))

    expect(onChange).toHaveBeenCalledWith('table')
  })
})
