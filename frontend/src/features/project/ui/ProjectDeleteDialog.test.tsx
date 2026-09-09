import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProjectDeleteDialog } from './ProjectDeleteDialog'

describe('ProjectDeleteDialog', () => {
  it('삭제 대상 프로젝트 이름과 확인 문구를 표시한다', () => {
    render(
      <ProjectDeleteDialog
        open
        projectName="홈페이지 개편"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog')).toHaveTextContent('홈페이지 개편')
    expect(screen.getByRole('dialog')).toHaveTextContent(
      '삭제하면 되돌릴 수 없어요.',
    )
  })

  it('확인하면 삭제 콜백을 호출한다', async () => {
    const onConfirm = vi.fn()
    render(
      <ProjectDeleteDialog
        open
        projectName="홈페이지 개편"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('취소하면 모달을 닫는다', async () => {
    const onOpenChange = vi.fn()
    render(
      <ProjectDeleteDialog
        open
        projectName="홈페이지 개편"
        onOpenChange={onOpenChange}
        onConfirm={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('삭제 중에는 버튼을 비활성화한다', () => {
    render(
      <ProjectDeleteDialog
        open
        projectName="홈페이지 개편"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        loading
      />,
    )

    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
  })

  it('삭제 오류를 모달 안에 표시한다', () => {
    render(
      <ProjectDeleteDialog
        open
        projectName="홈페이지 개편"
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        error="프로젝트를 삭제하지 못했어요"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      '프로젝트를 삭제하지 못했어요',
    )
  })
})
