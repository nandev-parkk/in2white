import * as React from 'react'
import { cn } from '@/shared/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'text-body placeholder:text-foreground-tertiary border-border bg-background-default text-foreground-default selection:bg-action-primary selection:text-action-primary-foreground focus:border-action-primary focus:ring-action-focus-ring disabled:border-border-subtle disabled:bg-background-subtle disabled:text-foreground-disabled disabled:placeholder:text-foreground-disabled aria-invalid:border-status-danger flex h-20 w-full resize-none rounded-md border px-4 py-2.5 transition-colors outline-none focus:ring-3 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
