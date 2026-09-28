import * as React from 'react'
import { CircleAlert } from 'lucide-react'

import { cn } from '@/shared/lib/utils'
import { CompactEmptyState } from '@/shared/ui/compact-empty-state'
import { EmptyState } from '@/shared/ui/empty-state'
import { MESSAGES } from '@/shared/constants/messages'

type ErrorStateSize = 'default' | 'compact'

type ErrorStateProps = {
  // EmptyState의 title은 div의 title 속성과 교차하므로 문자열만 받는다.
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  icon?: React.ReactNode
  size?: ErrorStateSize
  className?: string
}

function ErrorState({
  title,
  description = MESSAGES.common.error.retryHint,
  action,
  icon,
  size = 'default',
  className,
}: ErrorStateProps) {
  // 실패 아이콘은 위험색으로 고정하고 size에 따라 크기만 달라진다.
  const defaultIcon = (
    <CircleAlert
      className={cn(
        'text-status-danger',
        size === 'compact' ? 'size-5' : 'size-8',
      )}
    />
  )

  if (size === 'compact') {
    // CompactEmptyState에는 액션 슬롯이 없어 래퍼가 role="alert"와 액션을 함께 맡는다.
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-col items-center justify-center gap-3',
          className,
        )}
      >
        <CompactEmptyState
          icon={icon ?? defaultIcon}
          title={title}
          description={description}
        />
        {action}
      </div>
    )
  }

  return (
    <EmptyState
      role="alert"
      className={className}
      icon={icon ?? defaultIcon}
      title={title}
      description={description}
      action={action}
    />
  )
}

export { ErrorState }
export type { ErrorStateProps, ErrorStateSize }
