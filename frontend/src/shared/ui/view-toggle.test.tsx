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
