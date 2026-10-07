import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
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
  vi.restoreAllMocks()
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

it('터치 모달은 남은 공간에서 유지하고 겹치면 필요한 만큼만 이동한다', async () => {
  const visualViewport = new EventTarget() as VisualViewport & {
    height: number
  }
  Object.defineProperties(visualViewport, {
    height: { configurable: true, writable: true, value: window.innerHeight },
    offsetTop: { configurable: true, writable: true, value: 0 },
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  })
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: 1,
  })
  const getBoundingClientRect = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.getAttribute('data-slot') === 'dialog-content') {
        const inlineTop = Number.parseFloat(this.style.top)
        const top =
          this.style.translate === '-50% 0'
            ? inlineTop
            : (inlineTop || window.innerHeight / 2) - 100

        return {
          x: 0,
          y: top,
          top,
          right: 400,
          bottom: top + 200,
          left: 0,
          width: 400,
          height: 200,
          toJSON: () => ({}),
        } as DOMRect
      }

      return getBoundingClientRect.call(this)
    },
  )

  function TouchAutofocusDialog() {
    const [open, setOpen] = useState(false)
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>대화상자 열기</DialogTrigger>
        <DialogContent
          onOpenAutoFocus={(event) => {
            const content = event.currentTarget
            if (!(content instanceof HTMLElement)) return

            event.preventDefault()
            content.querySelector('input')?.focus({ preventScroll: true })
          }}
        >
          <DialogTitle>설정</DialogTitle>
          <input aria-label="이름" />
        </DialogContent>
      </Dialog>
    )
  }

  const user = userEvent.setup()
  render(<TouchAutofocusDialog />)
  await user.click(screen.getByRole('button', { name: '대화상자 열기' }))

  const dialog = await screen.findByRole('dialog', { name: '설정' })
  const originalTop = dialog.style.top
  expect(originalTop).not.toBe('')
  expect(screen.getByRole('textbox', { name: '이름' })).toHaveFocus()
  expect(dialog.style.getPropertyValue('translate')).toBe('-50% 0')

  visualViewport.height = window.innerHeight - 68
  visualViewport.dispatchEvent(new Event('resize'))
  expect(dialog.style.top).toBe(originalTop)
  expect(dialog.style.getPropertyValue('translate')).toBe('-50% 0')

  visualViewport.height = 600
  visualViewport.dispatchEvent(new Event('resize'))
  expect(dialog.style.top).toBe(originalTop)
  expect(dialog.style.getPropertyValue('translate')).toBe('-50% 0')

  visualViewport.height = 450
  visualViewport.dispatchEvent(new Event('resize'))
  expect(dialog.style.top).toBe(`${visualViewport.height - 200 - 16}px`)
  expect(dialog.style.getPropertyValue('translate')).toBe('-50% 0')

  visualViewport.height = window.innerHeight
  visualViewport.dispatchEvent(new Event('resize'))
  expect(dialog.style.top).toBe(`${window.innerHeight / 2}px`)
  expect(dialog.style.getPropertyValue('translate')).toBe('')
})
