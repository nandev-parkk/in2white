import * as React from 'react'
import { cn } from 'cn'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'

type PresenceUser = {
  id: string
  name: string
  imageUrl?: string
  /** 1-6, cycles through DESIGN.md §6.7 presence palette */
  presenceIndex: number
}

type PresenceAvatarStackProps = React.ComponentProps<'div'> & {
  users: PresenceUser[]
  max?: number
  size?: 'small' | 'default'
}

const overflowSizeClass = {
  small: 'size-6 text-[9px]',
  default: 'size-8 text-[11px]',
} as const

function PresenceAvatarStack({
  className,
  users,
  max = 3,
  size = 'default',
  ...props
}: PresenceAvatarStackProps) {
  const visible = users.slice(0, max)
  const overflow = users.length - visible.length
  const prefersReducedMotion = useReducedMotion()

  return (
    <div
      data-slot="presence-avatar-stack"
      className={cn('flex items-center', className)}
      {...props}
    >
      <AnimatePresence initial={false}>
        {visible.map((user) => (
          <motion.div
            key={user.id}
            layout={prefersReducedMotion ? undefined : 'position'}
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.82 }
            }
            animate={{ opacity: 1, scale: 1 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.82 }
            }
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="-mr-2.5 flex last:mr-0"
          >
            <Avatar
              role="img"
              aria-label={user.name}
              title={user.name}
              size={size}
              style={
                {
                  '--tw-ring-color': `var(--presence-${((user.presenceIndex - 1) % 6) + 1})`,
                } as React.CSSProperties
              }
              className={size === 'small' ? 'ring-1.5' : 'ring-2'}
            >
              {user.imageUrl && (
                <AvatarImage src={user.imageUrl} alt={user.name} />
              )}
              <AvatarFallback size={size}>
                {user.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
          </motion.div>
        ))}
      </AnimatePresence>
      {overflow > 0 && (
        <div
          className={cn(
            'border-background-default bg-background-subtle text-foreground-secondary flex items-center justify-center rounded-full border-2 font-bold',
            overflowSizeClass[size],
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

export { PresenceAvatarStack }
export type { PresenceUser }
