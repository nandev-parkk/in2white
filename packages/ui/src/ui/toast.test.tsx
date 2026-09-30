import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { toast, Toaster } from './toast'

describe('Toaster', () => {
  afterEach(() => {
    toast.dismiss()
  })

  it('토스트에 기본 너비를 적용하고 긴 문장을 줄바꿈한다', async () => {
    render(<Toaster />)

    const message =
      '워크스페이스 이름이 길어도 토스트는 고정된 너비 안에서 줄바꿈되어야 해요'
    act(() => {
      toast.success(message)
    })

    const toastMessage = await screen.findByText(message)
    const toastElement = toastMessage.closest('[data-sonner-toast]')

    expect(toastElement).toHaveClass(
      'w-80',
      'max-w-[calc(100vw-3rem)]',
      'break-words',
    )
    expect(toastElement?.querySelector('[data-content]')).toHaveClass('min-w-0')
  })

  it('로딩 토스트도 다른 토스트와 같은 테두리와 배경을 갖는다', async () => {
    render(<Toaster />)

    act(() => {
      toast.loading('PDF를 만드는 중이에요')
    })

    const toastElement = (
      await screen.findByText('PDF를 만드는 중이에요')
    ).closest('[data-sonner-toast]')

    expect(toastElement).toHaveClass(
      'border',
      'border-border',
      'bg-background-elevated',
      'text-foreground-strong',
    )
  })

  it('로딩 토스트는 공용 스피너를 아이콘으로 쓴다', async () => {
    render(<Toaster />)

    act(() => {
      toast.loading('PDF를 만드는 중이에요')
    })

    const toastElement = (
      await screen.findByText('PDF를 만드는 중이에요')
    ).closest('[data-sonner-toast]')

    expect(
      toastElement?.querySelector('[data-slot="spinner"]'),
    ).toBeInTheDocument()
  })

  it('아이콘 영역이 스피너의 위치 기준이 되도록 크기를 갖는다', async () => {
    render(<Toaster />)

    act(() => {
      toast.loading('PDF를 만드는 중이에요')
    })

    const toastElement = (
      await screen.findByText('PDF를 만드는 중이에요')
    ).closest('[data-sonner-toast]')

    // sonner의 로더는 position:absolute라 기준 박스가 없으면 토스트 한가운데로 겹친다.
    expect(toastElement?.querySelector('[data-icon]')).toHaveClass(
      'relative',
      'size-5',
      'shrink-0',
    )
  })
})
