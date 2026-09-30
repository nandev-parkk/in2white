import * as React from 'react'
import { cn } from '../lib/utils'

type PageHeaderProps = React.ComponentProps<'div'> & {
  breadcrumb?: React.ReactNode
  title: React.ReactNode
  action?: React.ReactNode
}

function PageHeader({
  className,
  breadcrumb,
  title,
  action,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn('flex flex-col gap-3', className)}
      {...props}
    >
      {breadcrumb}
      <div className="flex w-full items-center justify-between">
        <p className="text-heading1 text-foreground-strong">{title}</p>
        {action}
      </div>
    </div>
  )
}

export { PageHeader }
