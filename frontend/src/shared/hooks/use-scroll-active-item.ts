import * as React from 'react'

export type ScrollActiveItemOptions<TKey extends PropertyKey> = {
  activeKey?: TKey | null
  enabled?: boolean
  behavior?: ScrollBehavior
  block?: ScrollLogicalPosition
  inline?: ScrollLogicalPosition
}

export type UseScrollActiveItemResult<
  TKey extends PropertyKey,
  TElement extends HTMLElement = HTMLElement,
  TContainer extends HTMLElement = HTMLElement,
> = {
  containerRef: React.RefObject<TContainer | null>
  registerItem: (key: TKey) => (node: TElement | null) => void
}

export function useScrollActiveItem<
  TKey extends PropertyKey,
  TElement extends HTMLElement = HTMLElement,
  TContainer extends HTMLElement = HTMLElement,
>({
  activeKey,
  enabled = true,
  behavior = 'auto',
  block = 'center',
  inline = 'nearest',
}: ScrollActiveItemOptions<TKey>): UseScrollActiveItemResult<
  TKey,
  TElement,
  TContainer
> {
  const containerRef = React.useRef<TContainer | null>(null)
  const itemRefs = React.useRef(new Map<TKey, TElement>())

  const registerItem = React.useCallback(
    (key: TKey) => (node: TElement | null) => {
      if (node) itemRefs.current.set(key, node)
      else itemRefs.current.delete(key)
    },
    [],
  )

  React.useLayoutEffect(() => {
    if (!enabled || activeKey == null) return

    const activeItem = itemRefs.current.get(activeKey)
    if (!activeItem || typeof activeItem.scrollIntoView !== 'function') return

    activeItem.scrollIntoView({
      behavior,
      block,
      inline,
    })
  })

  return { containerRef, registerItem }
}
