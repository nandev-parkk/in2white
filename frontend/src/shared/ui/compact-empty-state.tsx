import * as React from 'react'
import { cn } from 'cn'

type CompactEmptyStateProps = React.ComponentProps<'div'> & {
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
}

function CompactEmptyState({
  className,
  icon,
  title,
  description,
  ...props
}: CompactEmptyStateProps) {
  return (
    <div
      data-slot="compact-empty-state"
      className={cn(
        'text-foreground-secondary flex min-h-24 flex-1 flex-col items-center justify-center gap-2 px-3 text-center',
        className,
      )}
      {...props}
    >
      <div className="text-foreground-tertiary flex size-5 items-center justify-center">
        {icon}
      </div>
      <p className="text-body-small text-foreground-strong">{title}</p>
      {description ? (
        <p className="text-caption text-foreground-tertiary">{description}</p>
      ) : null}
    </div>
  )
}

export { CompactEmptyState }
export type { CompactEmptyStateProps }
