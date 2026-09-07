import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

const inputVariants = cva(
  'text-body flex w-full min-w-0 rounded-md border border-border bg-background-default px-4 text-foreground-default outline-none transition-colors placeholder:text-foreground-tertiary selection:bg-action-primary selection:text-action-primary-foreground focus:border-action-primary focus:ring-3 focus:ring-action-focus-ring disabled:cursor-not-allowed disabled:border-border-subtle disabled:bg-background-subtle disabled:text-foreground-disabled disabled:placeholder:text-foreground-disabled aria-invalid:border-status-danger',
  {
    variants: {
      size: {
        default: 'h-(--component-control-height-default) rounded-md',
        large: 'h-(--component-control-height-large) rounded-lg',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

function Input({
  className,
  type,
  size = 'default',
  ...props
}: Omit<React.ComponentProps<'input'>, 'size'> &
  VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
