import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './confirm-dialog'

function renderConfirmDialog(
  props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {},
) {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()

  render(
    <ConfirmDialog
      open
      title="프로젝트 삭제"
      description="복구할 수 있어요"
      confirmLabel="삭제"
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      {...props}
    />,
  )

  return { onConfirm, onOpenChange }
}

describe('ConfirmDialog', () => {
  it('제목·설명과 확인 버튼을 보여주고 확인을 누르면 onConfirm을 호출한다', async () => {
    const { onConfirm } = renderConfirmDialog()

    expect(
      await screen.findByRole('dialog', { name: '프로젝트 삭제' }),
    ).toBeInTheDocument()
    expect(screen.getByText('복구할 수 있어요')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '삭제' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  /* 복구처럼 되돌릴 수 있는 확인도 있다. 기본값을 파괴적으로 두면 모두 빨갛게 보인다. */
  it('기본 확인 버튼은 primary이고 destructive일 때만 파괴적으로 보인다', () => {
    const { unmount } = render(
      <ConfirmDialog
        open
        title="프로젝트 복구"
        description="다시 보이게 됩니다"
        confirmLabel="복구"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '복구' })).toHaveAttribute(
      'data-variant',
      'primary',
    )
    unmount()

    renderConfirmDialog({ destructive: true })

    expect(screen.getByRole('button', { name: '삭제' })).toHaveAttribute(
      'data-variant',
      'destructive',
    )
  })

  it('취소를 누르면 onOpenChange(false)를 호출한다', async () => {
    const { onOpenChange } = renderConfirmDialog()

    await userEvent.click(screen.getByRole('button', { name: '취소' }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  /* 결과를 못 본 채 모달이 닫히면 성패를 알 수 없다. 요청 중에는 닫기를 모두 막는다. */
  it('요청 중에는 Escape로도 닫히지 않고 버튼이 비활성화된다', async () => {
    const { onOpenChange } = renderConfirmDialog({ loading: true })

    await userEvent.keyboard('{Escape}')

    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled()
  })

  it('오류가 있으면 alert로 알린다', () => {
    renderConfirmDialog({ error: '삭제하지 못했어요' })

    expect(screen.getByRole('alert')).toHaveTextContent('삭제하지 못했어요')
  })
})
