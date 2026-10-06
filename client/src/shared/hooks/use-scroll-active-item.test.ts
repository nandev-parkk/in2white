import { act, renderHook } from '@testing-library/react'
import { vi } from 'vitest'

import { useScrollActiveItem } from './use-scroll-active-item'

describe('useScrollActiveItem', () => {
  it('활성 항목을 수직 중앙으로 즉시 스크롤한다', () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useScrollActiveItem({
          activeKey: 'item-2',
          enabled,
        }),
      { initialProps: { enabled: false } },
    )
    const item = document.createElement('button')
    const scrollIntoView = vi.fn()
    item.scrollIntoView = scrollIntoView

    act(() => {
      result.current.registerItem('item-2')(item)
    })
    rerender({ enabled: true })

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'center',
      inline: 'nearest',
    })
  })

  it('활성 항목이 없거나 비활성화되면 스크롤하지 않는다', () => {
    const { result, rerender } = renderHook(
      ({ activeKey, enabled }: { activeKey: string; enabled: boolean }) =>
        useScrollActiveItem({ activeKey, enabled }),
      { initialProps: { activeKey: 'missing', enabled: true } },
    )
    const item = document.createElement('button')
    const scrollIntoView = vi.fn()
    item.scrollIntoView = scrollIntoView

    act(() => {
      result.current.registerItem('item-1')(item)
    })
    expect(scrollIntoView).not.toHaveBeenCalled()

    rerender({ activeKey: 'item-1', enabled: false })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
