import * as React from 'react'
import { cn } from 'cn'
import { Spinner } from '@/shared/ui/spinner'

type CompactLoadingStateProps = React.ComponentProps<'div'> & {
  title: React.ReactNode
  description?: React.ReactNode
}

function CompactLoadingState({
  className,
  title,
  description,
  ...props
}: CompactLoadingStateProps) {
  return (
    <div
      data-slot="compact-loading-state"
      role="status"
      className={cn(
        'text-foreground-secondary flex min-h-24 flex-1 flex-col items-center justify-center gap-2 px-3 text-center',
        className,
      )}
      {...props}
    >
      <div className="flex size-5 items-center justify-center">
        <Spinner
          aria-hidden="true"
          aria-label={undefined}
          role={undefined}
          className="size-5"
        />
      </div>
      <p className="text-body-small text-foreground-strong">{title}</p>
      {description ? (
        <p className="text-caption text-foreground-tertiary">{description}</p>
      ) : null}
    </div>
  )
}

export { CompactLoadingState }
export type { CompactLoadingStateProps }
