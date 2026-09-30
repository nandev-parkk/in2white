import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'
import { Loader2 } from 'lucide-react'
import { COMMON_MESSAGES } from '../constants/common-messages'

const spinnerVariants = cva(
  'animate-spin text-foreground-strong motion-reduce:animate-none',
  {
    variants: {
      size: {
        default: 'size-5',
        large: 'size-7',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
)

function Spinner({
  className,
  size = 'default',
  ...props
}: React.ComponentProps<'svg'> & VariantProps<typeof spinnerVariants>) {
  return (
    <Loader2
      role="status"
      aria-label={COMMON_MESSAGES.a11y.loading}
      data-slot="spinner"
      className={cn(spinnerVariants({ size, className }))}
      {...props}
    />
  )
}

export { Spinner }
