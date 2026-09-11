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
})
