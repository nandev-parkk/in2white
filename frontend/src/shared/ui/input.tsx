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

type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  VariantProps<typeof inputVariants> & {
    endAdornment?: React.ReactNode
  }

function Input({
  className,
  type,
  size = 'default',
  endAdornment,
  ...props
}: InputProps) {
  const input = (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size, className }))}
      {...props}
    />
  )

  if (!endAdornment) {
    return input
  }

  return (
    <span className="relative block w-full" data-slot="input-wrapper">
      {React.cloneElement(input, {
        className: cn(input.props.className, 'pr-12'),
      })}
      <span
        className="text-foreground-tertiary absolute inset-y-0 right-3 flex items-center"
        data-slot="input-end-adornment"
      >
        {endAdornment}
      </span>
    </span>
  )
}

export { Input, inputVariants }
export type { InputProps }
