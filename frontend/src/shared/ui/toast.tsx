import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Toast as ToastPrimitive } from 'radix-ui'

function ToastProvider({
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Provider>) {
  return <ToastPrimitive.Provider data-slot="toast-provider" {...props} />
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(
        'fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2 outline-none',
        className,
      )}
      {...props}
    />
  )
}

const toastVariants = cva(
  'text-body flex items-center gap-2.5 rounded-md px-4 py-3 text-foreground-strong shadow-sm',
  {
    variants: {
      semantic: {
        success: 'bg-status-success-subtle-bg',
        danger: 'bg-status-danger-subtle-bg',
        info: 'bg-status-info-subtle-bg',
        warning: 'bg-status-warning-subtle-bg',
      },
    },
    defaultVariants: {
      semantic: 'success',
    },
  },
)

const toastIcons = {
  success: CircleCheck,
  danger: CircleAlert,
  info: Info,
  warning: TriangleAlert,
} as const

function Toast({
  className,
  semantic = 'success',
  children,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> &
  VariantProps<typeof toastVariants>) {
  const Icon = toastIcons[semantic ?? 'success']

  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-semantic={semantic}
      className={cn(toastVariants({ semantic, className }))}
      {...props}
    >
      <Icon className="size-5 shrink-0" />
      <ToastPrimitive.Description asChild>
        <span>{children}</span>
      </ToastPrimitive.Description>
    </ToastPrimitive.Root>
  )
}

export { ToastProvider, ToastViewport, Toast }
