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

  React.useEffect(() => {
    const visualViewport = window.visualViewport
    if (!visualViewport) return

    function updateViewport() {
      const content = contentRef.current
      const currentViewport = window.visualViewport
      if (!content || !currentViewport) return

      content.style.top = `${currentViewport.offsetTop + currentViewport.height / 2}px`
      content.style.maxHeight = `calc(${currentViewport.height}px - 2rem)`
    }

    updateViewport()
    visualViewport.addEventListener('resize', updateViewport)
    visualViewport.addEventListener('scroll', updateViewport)

    return () => {
      visualViewport.removeEventListener('resize', updateViewport)
      visualViewport.removeEventListener('scroll', updateViewport)
    }
  }, [])

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={contentRef}
        tabIndex={-1}
        data-slot="dialog-content"
        className={cn(
          'bg-background-elevated data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-full max-w-90 -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg p-8 shadow-lg duration-180 ease-out outline-none motion-reduce:!animate-none',
          className,
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event)
          const hasTouchInput =
            navigator.maxTouchPoints > 0 ||
            window.matchMedia?.('(pointer: coarse)').matches === true

          if (event.defaultPrevented || !hasTouchInput) return

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
