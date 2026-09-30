import * as React from 'react'
import { cn } from '@in2white/ui/lib/utils'

type EmptyStateProps = React.ComponentProps<'div'> & {
  icon: React.ReactNode
  title: React.ReactNode
  description: React.ReactNode
  action?: React.ReactNode
}

function EmptyState({
  className,
  icon,
  title,
  description,
  action,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      <div className="text-foreground-tertiary flex size-10 items-center justify-center">
        {icon}
      </div>
      <p className="text-heading1 text-foreground-strong">{title}</p>
      <p className="text-body text-foreground-secondary max-w-xs">
        {description}
      </p>
      {action}
    </div>
  )
}

export { EmptyState }
