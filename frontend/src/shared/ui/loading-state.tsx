import { useEffect, useState, type ReactNode } from 'react'
import { cn } from 'cn'
import { Spinner } from '@/shared/ui/spinner'

type DelayedLoadingProps = {
  children: ReactNode
  className?: string
  startedAt?: number
  as?: 'div' | 'span'
}

export function DelayedLoading({
  children,
  className,
  startedAt,
  as: Tag = 'div',
}: DelayedLoadingProps) {
  const [visible, setVisible] = useState(
    () => startedAt !== undefined && Date.now() - startedAt >= 300,
  )

  useEffect(() => {
    const delay =
      startedAt === undefined
        ? 300
        : Math.max(0, 300 - (Date.now() - startedAt))
    const timer = window.setTimeout(() => setVisible(true), delay)
    return () => window.clearTimeout(timer)
  }, [startedAt])

  return (
    <Tag
      className={className}
      style={{ visibility: visible ? 'visible' : 'hidden' }}
      aria-hidden={!visible || undefined}
      inert={!visible}
    >
      {children}
    </Tag>
  )
}

export function LoadingState({
  label,
  className,
  startedAt,
}: Omit<DelayedLoadingProps, 'children' | 'as'> & { label: string }) {
  return (
    <DelayedLoading
      startedAt={startedAt}
      className={cn(
        'flex min-h-64 flex-1 items-center justify-center',
        className,
      )}
    >
      <div
        role="status"
        className="text-body text-foreground-secondary flex flex-col items-center gap-4 px-4 text-center"
      >
        <Spinner
          size="large"
          className="text-foreground-default"
          aria-hidden="true"
        />
        <p>{label}</p>
      </div>
    </DelayedLoading>
  )
}
