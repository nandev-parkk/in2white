import * as React from 'react'
import { cn } from '@/shared/lib/utils'
import { ArrowLeft, CircleAlert, CircleCheck } from 'lucide-react'
import { Spinner } from '@/shared/ui/spinner'
import { Badge } from '@/shared/ui/badge'
import {
  PresenceAvatarStack,
  type PresenceUser,
} from '@/shared/ui/presence-avatar-stack'

type SaveStatus = 'saved' | 'saving' | 'disconnected' | 'connecting' | 'error'

type CanvasTopBarProps = React.ComponentProps<'div'> & {
  title: string
  saveStatus?: SaveStatus
  users?: PresenceUser[]
  onBack?: () => void
  actions?: React.ReactNode
}

type BadgeSemantic = React.ComponentProps<typeof Badge>['semantic']

const saveStatusConfig: Record<
  SaveStatus,
  { icon: React.ElementType; label: string; semantic: BadgeSemantic }
> = {
  saved: { icon: CircleCheck, label: '저장 완료', semantic: 'success' },
  connecting: { icon: Spinner, label: '연결 중', semantic: 'neutral' },
  error: {
    icon: CircleAlert,
    label: '저장 상태 확인 필요',
    semantic: 'danger',
  },
  saving: { icon: Spinner, label: '저장 중', semantic: 'neutral' },
  disconnected: {
    icon: CircleAlert,
    label: '동기화가 끊겼어요',
    semantic: 'danger',
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
    semantic,
  } = saveStatusConfig[saveStatus ?? 'connecting']

  return (
    <div
      data-slot="canvas-top-bar"
      className={cn(
        'border-border-subtle bg-background-default flex h-(--layout-container-canvas-top-bar-height) items-center justify-between border-b px-(--layout-container-canvas-top-bar-padding-x)',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="뒤로 가기"
          className="text-foreground-default flex size-5 shrink-0 items-center justify-center"
        >
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-heading3 text-foreground-strong truncate">{title}</p>
        {saveStatus && (
          <Badge
            semantic={semantic}
            role="status"
            aria-live="polite"
            className="gap-1.5"
          >
            {/* Spinner에 size-3을 명시해 회전 애니메이션은 유지하면서 크기를 Badge의 아이콘 규칙에 맞춘다 */}
            <StatusIcon aria-hidden="true" className="size-3" />
            {label}
          </Badge>
        )}
      </div>
      {saveStatus && (
        <div className="flex shrink-0 items-center gap-3">
          {users.length > 0 &&
            (saveStatus === 'saved' || saveStatus === 'saving') && (
              <PresenceAvatarStack users={users} max={3} size="small" />
            )}
          {actions}
        </div>
      )}
    </div>
  )
}

export { CanvasTopBar }
