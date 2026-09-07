import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Loader2 } from 'lucide-react'
import { Slot } from 'radix-ui'

const buttonVariants = cva(
  "text-label inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap transition-colors outline-none select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-3 focus-visible:ring-action-focus-ring [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          'bg-action-primary text-action-primary-foreground hover:bg-action-primary-hover active:bg-action-primary-active',
        secondary:
          'bg-action-secondary text-action-secondary-foreground hover:bg-action-secondary-hover',
        tertiary:
          'border border-border bg-transparent text-foreground-default hover:bg-action-secondary',
        ghost:
          'bg-transparent text-foreground-secondary hover:bg-action-secondary hover:text-foreground-default',
        destructive:
          'bg-status-danger text-action-primary-foreground hover:bg-status-danger-hover',
      },
      size: {
        default: 'h-(--component-control-height-default) rounded-md px-4',
        large: 'h-(--component-control-height-large) rounded-lg px-6',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'primary',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
