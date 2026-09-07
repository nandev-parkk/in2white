import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from 'cn'
import { Loader2 } from 'lucide-react'

const spinnerVariants = cva('animate-spin text-foreground-tertiary', {
  variants: {
    size: {
      default: 'size-5',
      large: 'size-7',
    },
  },
  defaultVariants: {
    size: 'default',
  },
})

function Spinner({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'svg'> & VariantProps<typeof spinnerVariants>) {
  return (
    <Loader2
      role="status"
      aria-label="로딩 중"
      data-slot="spinner"
      className={cn(spinnerVariants({ size, className }))}
      {...props}
    />
  )
}

export { Spinner }
