import * as React from 'react'
import { motion } from 'motion/react'
import { cn } from '@in2white/ui/lib/utils'
import { Calendar, Clock } from 'lucide-react'
import { useCardMotion } from '@in2white/ui/lib/hooks/use-card-motion'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { MESSAGES } from '@/shared/constants/messages'

// motion.article과 이름이 겹치는 drag·animation 핸들러만 제외하고 article 속성을 받는다
type WhiteboardCardProps = Omit<
  React.ComponentProps<'article'>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
> & {
  title: string
  createdAtLabel: string
  updatedAtLabel: string
  creatorName: string
  menu?: React.ReactNode
  onOpen?: () => void
}

function WhiteboardCard({
  className,
  title,
  createdAtLabel,
  updatedAtLabel,
  creatorName,
  menu,
  onOpen,
  ...props
}: WhiteboardCardProps) {
  const cardMotion = useCardMotion()

  return (
    <motion.article
      data-slot="whiteboard-card"
      {...cardMotion}
      className={cn(
        'border-border-subtle bg-background-default hover:border-border flex w-full flex-col overflow-hidden rounded-md border transition-colors duration-150 ease-out motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      <div className="bg-background-subtle relative h-26 bg-[radial-gradient(var(--border-strong)_1.5px,transparent_1.5px)] bg-[length:32px_32px] bg-[position:16px_16px]">
        {menu && <div className="absolute top-2 right-2">{menu}</div>}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="text-card-title text-foreground-strong">
          {onOpen ? (
            <button
              type="button"
              className="text-left hover:underline focus-visible:outline-2"
              onClick={onOpen}
            >
              {title}
            </button>
          ) : (
            title
          )}
        </p>
        <div className="flex flex-col gap-1">
          <div className="text-foreground-tertiary flex items-center gap-1.5">
            <Calendar className="size-3.5" />
            <span className="text-caption">
              {MESSAGES.common.label.createdAt} {createdAtLabel}
            </span>
          </div>
          <div className="text-foreground-tertiary flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <span className="text-caption">
              {MESSAGES.common.label.updatedAt} {updatedAtLabel}
            </span>
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
    </motion.article>
  )
}

export { WhiteboardCard }
