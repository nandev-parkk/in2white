import * as React from 'react'
import { cn } from '@/shared/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card"
      className={cn(
        'border-border-subtle bg-background-default flex flex-col gap-2 rounded-md border p-4',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex w-full items-center justify-between', className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-title"
      className={cn('text-card-title text-foreground-strong w-full', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-body text-foreground-secondary w-full', className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'border-border-subtle flex w-full items-center justify-end gap-2 border-t pt-2',
        className,
      )}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
