import * as React from 'react'
import { cn } from 'cn'
import { Search as SearchIcon } from 'lucide-react'

function Search({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <div
      className={cn(
        'bg-background-subtle has-[input:focus]:border-action-primary has-[input:focus]:ring-action-focus-ring flex h-(--component-control-height-default) w-60 items-center gap-2 rounded-full px-4 has-[input:focus]:border has-[input:focus]:ring-3',
        className,
      )}
    >
      <SearchIcon className="text-foreground-tertiary size-4 shrink-0" />
      <input
        type="search"
        data-slot="search"
        className="text-body text-foreground-default placeholder:text-foreground-tertiary min-w-0 flex-1 bg-transparent outline-none"
        {...props}
      />
    </div>
  )
}

export { Search }
