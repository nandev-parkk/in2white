import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog'

function DialogExample() {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>대화상자 열기</DialogTrigger>
      <DialogContent>
        <DialogTitle>설정</DialogTitle>
        <input aria-label="이름" />
      </DialogContent>
    </Dialog>
  )
}

afterEach(() => {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: undefined,
  })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 0,
  })
})

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

it('터치 기기에서는 입력란에 자동 포커스하지 않는다', async () => {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 1,
  })
  const user = userEvent.setup()
  render(<DialogExample />)

  await user.click(screen.getByRole('button', { name: '대화상자 열기' }))

  expect(await screen.findByRole('dialog', { name: '설정' })).toHaveFocus()
  expect(screen.getByRole('textbox', { name: '이름' })).not.toHaveFocus()
})

it('데스크톱에서는 입력란에 자동 포커스한다', async () => {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 0,
  })
  const user = userEvent.setup()
  render(<DialogExample />)

  await user.click(screen.getByRole('button', { name: '대화상자 열기' }))

  expect(await screen.findByRole('textbox', { name: '이름' })).toHaveFocus()
})

it('키보드가 열린 동안 모달을 표시 영역 위쪽에 두고 닫히면 중앙으로 돌린다', async () => {
  const visualViewport = new EventTarget() as VisualViewport & {
    height: number
  }
  Object.defineProperties(visualViewport, {
    height: { configurable: true, writable: true, value: 400 },
    offsetTop: { configurable: true, writable: true, value: 0 },
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  })
  expect(window.visualViewport?.height).toBe(400)
  const user = userEvent.setup()
  render(<DialogExample />)

  await user.click(screen.getByRole('button', { name: '대화상자 열기' }))
  const dialog = await screen.findByRole('dialog', { name: '설정' })

  await waitFor(() => expect(dialog.style.top).toBe('16px'))
  expect(dialog.style.getPropertyValue('translate')).toBe('-50% 0')
  expect(dialog.style.maxHeight).toBe('calc(400px - 2rem)')

  visualViewport.height = window.innerHeight
  visualViewport.dispatchEvent(new Event('resize'))

  await waitFor(() =>
    expect(dialog.style.top).toBe(`${window.innerHeight / 2}px`),
  )
  expect(dialog.style.getPropertyValue('translate')).toBe('')
})
