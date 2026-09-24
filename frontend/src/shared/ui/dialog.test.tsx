import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog'

function DialogExample() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>대화상자 열기</DialogTrigger>
      <DialogContent>
        <DialogTitle>설정</DialogTitle>
      </DialogContent>
    </Dialog>
  )
}

it('페이드·크기 전환을 표시하고 Escape 후 트리거로 포커스를 돌린다', async () => {
  const user = userEvent.setup()
  render(<DialogExample />)

  const trigger = screen.getByRole('button', { name: '대화상자 열기' })
  await user.click(trigger)
  const dialog = await screen.findByRole('dialog', { name: '설정' })
  const overlay = document.querySelector('[data-slot="dialog-overlay"]')

  expect(overlay).toHaveClass('data-[state=open]:fade-in-0')
  expect(overlay).toHaveClass('data-[state=closed]:fade-out-0')
  expect(overlay).toHaveClass('motion-reduce:!animate-none')
  expect(dialog).toHaveClass('data-[state=open]:zoom-in-95')
  expect(dialog).toHaveClass('data-[state=closed]:zoom-out-95')
  expect(dialog).toHaveClass('motion-reduce:!animate-none')

  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
  expect(trigger).toHaveFocus()
})
