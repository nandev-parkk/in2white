import * as React from 'react'
import { cn } from 'cn'
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

  return (
    <div
      data-slot="presence-avatar-stack"
      className={cn('flex items-center', className)}
      {...props}
    >
      {visible.map((user) => (
        <Avatar
          key={user.id}
          role="img"
          aria-label={user.name}
          title={user.name}
          size={size}
          className={cn(
            '-mr-2.5 last:mr-0',
            size === 'small' ? 'ring-1.5' : 'ring-2',
          )}
          style={
            {
              '--tw-ring-color': `var(--presence-${((user.presenceIndex - 1) % 6) + 1})`,
            } as React.CSSProperties
          }
        >
          {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name} />}
          <AvatarFallback size={size}>{user.name.slice(0, 2)}</AvatarFallback>
        </Avatar>
      ))}
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
