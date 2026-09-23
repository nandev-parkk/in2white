import * as React from 'react'
import { cn } from 'cn'
import { ArrowLeft, CircleAlert, CircleCheck } from 'lucide-react'
import { Spinner } from '@/shared/ui/spinner'
import {
  PresenceAvatarStack,
  type PresenceUser,
} from '@/shared/ui/presence-avatar-stack'

type SaveStatus = 'saved' | 'saving' | 'disconnected' | 'connecting' | 'error'

type CanvasTopBarProps = React.ComponentProps<'div'> & {
  title: string
  saveStatus: SaveStatus
  users?: PresenceUser[]
  onBack?: () => void
  actions?: React.ReactNode
}

const saveStatusConfig: Record<
  SaveStatus,
  { icon: React.ElementType; label: string; className?: string }
> = {
  saved: { icon: CircleCheck, label: '저장됨' },
  connecting: { icon: Spinner, label: '연결 중...' },
  error: {
    icon: CircleAlert,
    label: '저장 상태 확인 필요',
    className: 'text-status-danger',
  },
  saving: { icon: Spinner, label: '저장 중...' },
  disconnected: {
    icon: CircleAlert,
    label: '동기화가 끊겼어요',
    className: 'text-status-warning',
  },
}

function CanvasTopBar({
  className,
  title,
  saveStatus,
  users = [],
  onBack,
  actions,
  ...props
}: CanvasTopBarProps) {
  const {
    icon: StatusIcon,
    label,
    className: statusClassName,
  } = saveStatusConfig[saveStatus]

  return (
    <div
      data-slot="canvas-top-bar"
      className={cn(
        'border-border-subtle bg-background-default flex h-(--layout-container-canvas-top-bar-height) items-center justify-between border-b px-(--layout-container-canvas-top-bar-padding-x)',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="text-foreground-default flex size-5 items-center justify-center"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-heading3 text-foreground-strong">{title}</p>
        <div
          className={cn(
            'text-caption text-foreground-secondary flex items-center gap-1.5',
            statusClassName,
          )}
        >
          <StatusIcon className="size-3.5" />
          <span role="status" aria-live="polite">
            {label}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {users.length > 0 && (
          <PresenceAvatarStack users={users} max={3} size="small" />
        )}
        {actions}
      </div>
    </div>
  )
}

export { CanvasTopBar }
