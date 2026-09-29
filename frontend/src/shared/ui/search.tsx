import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { Search as SearchIcon, X } from 'lucide-react'
import { MESSAGES } from '@/shared/constants/messages'

type SearchProps = React.ComponentProps<'input'> & {
  onClear?: () => void
}

function Search({ className, onClear, value, ...props }: SearchProps) {
  return (
    <div
      className={cn(
        'bg-background-subtle has-[input:focus]:border-action-primary has-[input:focus]:ring-action-focus-ring relative flex h-(--component-control-height-default) w-60 items-center gap-2 rounded-full px-4 has-[input:focus]:border has-[input:focus]:ring-3',
        className,
      )}
    >
      <SearchIcon className="text-foreground-tertiary size-4 shrink-0" />
      <input
        type="text"
        role="searchbox"
        inputMode="search"
        value={value}
        data-slot="search"
        className={cn(
          'text-body text-foreground-default placeholder:text-foreground-tertiary min-w-0 flex-1 bg-transparent outline-none',
          onClear && value ? 'pr-6' : undefined,
        )}
        {...props}
      />
      {onClear && value ? (
        <button
          type="button"
          aria-label={MESSAGES.common.a11y.clearSearchInput}
          onClick={onClear}
          className="text-foreground-tertiary hover:text-foreground-default focus-visible:ring-action-focus-ring absolute right-3 flex size-5 items-center justify-center rounded-full transition-colors duration-150 ease-out outline-none focus-visible:ring-2 motion-reduce:transition-none"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export { Search }
export type { SearchProps }
