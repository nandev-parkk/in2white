import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'

const inputVariants = cva(
  'w-full bg-[var(--color-background-default)] text-[14px] font-medium leading-[1.429] tracking-[0.0145em] text-[var(--color-foreground-default)] placeholder:text-[var(--color-foreground-tertiary)] border border-solid border-[var(--color-border-default)] outline-none transition-colors focus:border-[var(--color-action-primary)] focus:shadow-[0_0_0_3px_var(--color-action-focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-background-subtle)] disabled:border-[var(--color-border-subtle)] disabled:text-[var(--color-foreground-disabled)] aria-invalid:border-[var(--color-status-danger)]',
  {
    variants: {
      size: {
        default: 'h-9 rounded-md px-4',
        large: 'h-11 rounded-lg px-4',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

export interface InputProps
  extends React.ComponentProps<'input'>, VariantProps<typeof inputVariants> {}

function Input({ className, size, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ size, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
