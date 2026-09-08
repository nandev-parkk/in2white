import * as React from 'react'
import { cn } from 'cn'
import { Calendar, Clock, MoreVertical } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'

type WhiteboardCardProps = React.ComponentProps<'div'> & {
  title: string
  createdAtLabel: string
  updatedAtLabel: string
  creatorName: string
  onMenuClick?: () => void
}

function WhiteboardCard({
  className,
  title,
  createdAtLabel,
  updatedAtLabel,
  creatorName,
  onMenuClick,
  ...props
}: WhiteboardCardProps) {
  return (
    <div
      data-slot="whiteboard-card"
      className={cn(
        'border-border-subtle bg-background-default flex w-58 flex-col overflow-hidden rounded-md border',
        className,
      )}
      {...props}
    >
      <div className="bg-background-subtle relative h-26 bg-[radial-gradient(var(--border-strong)_1.5px,transparent_1.5px)] bg-[length:32px_32px] bg-[position:16px_16px]">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label="더 보기"
            className="bg-background-default text-foreground-secondary absolute top-2 right-2 flex size-7 items-center justify-center rounded-md"
          >
            <MoreVertical className="size-4" />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="text-card-title text-foreground-strong">{title}</p>
        <div className="flex flex-col gap-1">
          <div className="text-foreground-tertiary flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span className="text-caption">생성일 {createdAtLabel}</span>
          </div>
          <div className="text-foreground-tertiary flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <span className="text-caption">수정일 {updatedAtLabel}</span>
          </div>
        </div>
        <div className="bg-border-subtle h-px w-full" />
        <div className="flex items-center justify-end gap-2">
          <Avatar size="small">
            <AvatarFallback size="small">
              {creatorName.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <span className="text-body-small text-foreground-secondary">
            {creatorName}
          </span>
        </div>
      </div>
    </div>
  )
}

export { WhiteboardCard }
