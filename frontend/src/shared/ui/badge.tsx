import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

const badgeVariants = cva(
  "text-caption inline-flex w-fit shrink-0 items-center justify-center rounded-sm px-2 py-1 whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg:not([class*='size-'])]:size-3",
  {
    variants: {
      semantic: {
        neutral: 'bg-background-subtle text-foreground-default',
        info: 'bg-status-info-subtle-bg text-status-info',
        success: 'bg-status-success-subtle-bg text-status-success',
        warning: 'bg-status-warning-subtle-bg text-status-warning',
        danger: 'bg-status-danger-subtle-bg text-status-danger',
      },
    },
    defaultVariants: {
      semantic: 'neutral',
    },
  },
)

function Badge({
  className,
  semantic = 'neutral',
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-semantic={semantic}
      className={cn(badgeVariants({ semantic, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
