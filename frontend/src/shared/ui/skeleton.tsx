import * as React from 'react'
import { cn } from 'cn'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-background-subtle animate-pulse rounded-sm', className)}
      {...props}
    />
  )
}

function SkeletonListCell({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton-list-cell"
      className={cn(
        'bg-background-default flex items-center gap-(--component-list-cell-gap) px-(--component-list-cell-padding-horizontal) py-(--component-list-cell-padding-vertical)',
        className,
      )}
      {...props}
    >
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex min-w-px flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-2.5 w-25" />
      </div>
    </div>
  )
}

export { Skeleton, SkeletonListCell }
