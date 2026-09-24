import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      aria-label="pagination"
      data-slot="pagination"
      className={cn('flex items-center gap-1', className)}
      {...props}
    />
  )
}

function PaginationItem({
  className,
  isActive,
  ...props
}: React.ComponentProps<'button'> & { isActive?: boolean }) {
  return (
    <button
      type="button"
      data-slot="pagination-item"
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'text-foreground-secondary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md text-[13px] transition-colors outline-none focus-visible:ring-3',
        isActive &&
          'bg-action-secondary text-foreground-strong hover:bg-action-secondary font-semibold',
        className,
      )}
      {...props}
    />
  )
}

function PaginationPrevious({
  className,
  disabled,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label="이전 페이지"
      data-slot="pagination-previous"
      disabled={disabled}
      className={cn(
        'text-foreground-secondary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <ChevronLeft className="size-3.5" />
    </button>
  )
}

function PaginationNext({
  className,
  disabled,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      aria-label="다음 페이지"
      data-slot="pagination-next"
      disabled={disabled}
      className={cn(
        'text-foreground-secondary hover:bg-action-secondary-hover focus-visible:ring-action-focus-ring flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      <ChevronRight className="size-3.5" />
    </button>
  )
}

export { Pagination, PaginationItem, PaginationPrevious, PaginationNext }
