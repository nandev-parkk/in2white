import * as React from 'react'
import { cn } from 'cn'
import { ChevronRight } from 'lucide-react'

type ListCellProps = React.ComponentProps<'div'> & {
  leading?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
}

function ListCell({
  className,
  leading,
  title,
  subtitle,
  trailing,
  ...props
}: ListCellProps) {
  return (
    <div
      data-slot="list-cell"
      className={cn(
        'bg-background-default hover:bg-background-subtle flex cursor-pointer items-center gap-(--component-list-cell-gap) px-(--component-list-cell-padding-horizontal) py-(--component-list-cell-padding-vertical) transition-colors',
        className,
      )}
      {...props}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex min-w-px flex-1 flex-col gap-0.5">
        <p className="text-heading3 text-foreground-strong truncate">{title}</p>
        {subtitle && (
          <p className="text-caption text-foreground-secondary truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div className="text-foreground-tertiary shrink-0">
        {trailing ?? <ChevronRight className="size-4" />}
      </div>
    </div>
  )
}

export { ListCell }
