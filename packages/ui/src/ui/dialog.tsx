import * as React from 'react'
import { cn } from '../lib/utils'
import { Dialog as DialogPrimitive } from 'radix-ui'

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 fixed inset-0 z-50 bg-black/40 duration-150 motion-reduce:!animate-none',
        className,
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  onOpenAutoFocus,
  style,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const keyboardViewportHeight = React.useRef<number | null>(null)
  const keyboardWindowHeight = React.useRef<number | null>(null)
  const keyboardWasOpen = React.useRef(false)
  const hasTouchInput = () =>
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches === true
  const [contentElement, setContentElement] =
    React.useState<HTMLDivElement | null>(null)
  const setContentRef = React.useCallback((content: HTMLDivElement | null) => {
    contentRef.current = content
    setContentElement(content)
  }, [])

  React.useEffect(() => {
    if (!contentElement) return
    const visualViewport = window.visualViewport
    if (!visualViewport) return

    function updateViewport() {
      const content = contentRef.current
      const currentViewport = window.visualViewport
      if (!content || !currentViewport) return

      // 주소창 변화는 넘기고, 소프트 키보드가 표시될 만큼 줄었는지 판단한다.
      const hasFocusedTextInput = content.querySelector(
        'input:focus, textarea:focus, [contenteditable="true"]:focus',
      )
      const touchInputFocused = hasTouchInput() && hasFocusedTextInput !== null
      const viewportShrunkAfterInputFocus =
        (keyboardViewportHeight.current !== null &&
          keyboardViewportHeight.current - currentViewport.height > 100) ||
        (keyboardWindowHeight.current !== null &&
          keyboardWindowHeight.current - window.innerHeight > 100)
      const keyboardOpen =
        viewportShrunkAfterInputFocus ||
        (keyboardWindowHeight.current === null &&
          window.innerHeight - currentViewport.height > 100)
      content.style.maxHeight = `calc(${currentViewport.height}px - 2rem)`

      if (keyboardOpen) {
        if (touchInputFocused) keyboardWasOpen.current = true

        // 현재 위치에서 키보드가 실제로 겹치는지만 확인한다.
        const { top, bottom } = content.getBoundingClientRect()
        const viewportTop = currentViewport.offsetTop
        const viewportBottom = viewportTop + currentViewport.height
        const hasNoMeasuredHeight = bottom <= top

        if (
          hasNoMeasuredHeight ||
          top < viewportTop ||
          bottom > viewportBottom
        ) {
          content.style.top = `${viewportTop + 16}px`
          content.style.setProperty('translate', '-50% 0')
        }
        return
      }

      if (touchInputFocused) {
        // 자동 포커스 직후와 키보드 표시 중에는 중앙 정렬하지 않는다.
        if (!keyboardWasOpen.current) return
        if (
          keyboardViewportHeight.current !== null &&
          currentViewport.height < keyboardViewportHeight.current
        ) {
          return
        }
      }

      keyboardWasOpen.current = false
      content.style.top = `${currentViewport.offsetTop + currentViewport.height / 2}px`
      content.style.removeProperty('translate')
    }

    updateViewport()
    visualViewport.addEventListener('resize', updateViewport)
    visualViewport.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    window.addEventListener('scroll', updateViewport, { passive: true })

    return () => {
      visualViewport.removeEventListener('resize', updateViewport)
      visualViewport.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      window.removeEventListener('scroll', updateViewport)
    }
  }, [contentElement])

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={setContentRef}
        tabIndex={-1}
        data-slot="dialog-content"
        className={cn(
          'bg-background-elevated data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-full max-w-90 -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg p-8 shadow-lg duration-180 ease-out outline-none motion-reduce:!animate-none',
          className,
        )}
        onOpenAutoFocus={(event) => {
          const touchInput = hasTouchInput()
          const viewportHeightBeforeFocus = window.visualViewport?.height
          const content = contentRef.current
          const contentTop = content?.getBoundingClientRect().top
          onOpenAutoFocus?.(event)

          if (
            touchInput &&
            content &&
            contentTop !== undefined &&
            content.querySelector(
              'input:focus, textarea:focus, [contenteditable="true"]:focus',
            )
          ) {
            keyboardViewportHeight.current = viewportHeightBeforeFocus ?? null
            keyboardWindowHeight.current = window.innerHeight
            content.style.top = `${contentTop}px`
            content.style.setProperty('translate', '-50% 0')
          }

          if (event.defaultPrevented || !touchInput) return

          event.preventDefault()
          contentRef.current?.focus({ preventScroll: true })
        }}
        style={style}
        {...props}
      >
        <div className="flex flex-col gap-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('text-heading1 text-foreground-strong', className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-body text-foreground-secondary', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex items-center justify-end gap-3', className)}
      {...props}
    />
  )
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
}
