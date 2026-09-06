import * as React from 'react'
import { cn } from 'cn'
import { MousePointer2 } from 'lucide-react'

type LiveCursorProps = React.ComponentProps<'div'> & {
  name: string
  /** 1-6, cycles through DESIGN.md §6.7 presence palette */
  presenceIndex: number
}

function LiveCursor({
  className,
  name,
  presenceIndex,
  style,
  ...props
}: LiveCursorProps) {
  const color = `var(--presence-${((presenceIndex - 1) % 6) + 1})`

  return (
    <div
      data-slot="live-cursor"
      className={cn('pointer-events-none flex flex-col items-start', className)}
      style={{ color, ...style }}
      {...props}
    >
      <MousePointer2 className="size-4.5 fill-current" />
      <span
        className="text-caption rounded-sm px-2 py-1 text-white"
        style={{ backgroundColor: color }}
      >
        {name}
      </span>
    </div>
  )
}

export { LiveCursor }
