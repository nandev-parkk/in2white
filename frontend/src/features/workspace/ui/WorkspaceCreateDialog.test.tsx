import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { WorkspaceCreateDialog } from './WorkspaceCreateDialog'

describe('WorkspaceCreateDialog', () => {
  it('이름이 비어 있으면 제출하지 않고 필수 오류를 표시한다', async () => {
    const onSubmit = vi.fn()
    render(
      <WorkspaceCreateDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    )

    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(
      screen.getByText('워크스페이스 이름을 입력해주세요'),
    ).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('유효한 이름은 공백을 제거해 제출한다', async () => {
    const onSubmit = vi.fn()
    render(
      <WorkspaceCreateDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />,
    )

    await userEvent.type(screen.getByLabelText('이름'), '  새 팀  ')
    await userEvent.click(screen.getByRole('button', { name: '만들기' }))

    expect(onSubmit).toHaveBeenCalledWith('새 팀')
  })

  it('취소하면 모달을 닫는다', async () => {
    const onOpenChange = vi.fn()
    render(
      <WorkspaceCreateDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('생성 중에는 버튼을 비활성화한다', () => {
    const onSubmit = vi.fn()
    render(
      <WorkspaceCreateDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        loading
      />,
    )

    expect(screen.getByRole('button', { name: '만들기' })).toBeDisabled()
  })

  it('생성 중에는 취소 버튼도 비활성화한다', () => {
    render(
      <WorkspaceCreateDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        loading
      />,
    )

    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
  })

  it('생성 중 입력 필드에서 Enter를 눌러도 제출하지 않는다', async () => {
    const onSubmit = vi.fn()
    render(
      <WorkspaceCreateDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        loading
      />,
    )

    const input = screen.getByLabelText('이름')
    await userEvent.type(input, '새 팀')
    await userEvent.keyboard('{Enter}')
    fireEvent.submit(input.closest('form') as HTMLFormElement)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('Figma 규격에 맞는 227px 높이로 표시한다', () => {
    render(
      <WorkspaceCreateDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />,
    )

    expect(screen.getByRole('dialog')).toHaveClass('h-[227px]')
  })

  it('오류 상태에서는 고정 높이 안에서 세로 스크롤을 허용한다', () => {
    render(
      <WorkspaceCreateDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        error="워크스페이스를 만들지 못했어요"
      />,
    )

    expect(screen.getByRole('dialog')).toHaveClass(
      'h-[227px]',
      'overflow-y-auto',
    )
  })

  it('생성 오류를 모달 안에 표시한다', () => {
    render(
      <WorkspaceCreateDialog
        open
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
        error="워크스페이스를 만들지 못했어요"
      />,
    )

    expect(
      screen.getByText('워크스페이스를 만들지 못했어요'),
    ).toBeInTheDocument()
  })
})
