import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import type { AdminDependencyStatus } from '@/entities/system'
import { useSystemStatus } from '@/features/system'
import { MESSAGES } from '@/shared/constants/messages'
import { formatDateTime } from '@/shared/lib/format-date'
import { Badge } from '@in2white/ui/badge'
import { Button } from '@in2white/ui/button'
import { Card, CardDescription, CardTitle } from '@in2white/ui/card'
import { ErrorState } from '@in2white/ui/error-state'
import { LoadingState } from '@in2white/ui/loading-state'
import { PageHeader } from '@in2white/ui/page-header'

type DependencyCardProps = {
  label: string
  description: string
  dependency: AdminDependencyStatus
}

function DependencyCard({
  label,
  description,
  dependency,
}: DependencyCardProps) {
  const isUp = dependency.status === 'up'

  return (
    <Card className="gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <CardTitle className="text-[14px] leading-[1.429] font-medium">
            {label}
          </CardTitle>
          <CardDescription className="text-foreground-tertiary text-[12px] leading-[1.4]">
            {description}
          </CardDescription>
        </div>
        <Badge semantic={isUp ? 'success' : 'danger'}>
          {isUp ? MESSAGES.system.status.up : MESSAGES.system.status.down}
        </Badge>
      </div>
      {/* 응답 시간은 "살아 있지만 느린" 상태를 드러낸다 — up/down만으로는 안 보인다. */}
      <p className="text-foreground-secondary text-[14px] leading-[1.429]">
        {MESSAGES.system.dependency.latency(dependency.latencyMs)}
      </p>
    </Card>
  )
}

function RealtimeCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="gap-1">
      <CardDescription className="text-[14px] leading-[1.429]">
        {label}
      </CardDescription>
      <CardTitle className="text-[28px] leading-[1.3] font-bold tracking-[-0.4px]">
        {value}
      </CardTitle>
    </Card>
  )
}

function SystemPage() {
  useDocumentTitle('in2white admin | 운영 상태')

  const statusQuery = useSystemStatus()
  const status = statusQuery.data

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      <PageHeader
        title={MESSAGES.system.heading.page}
        action={
          <Button
            variant="secondary"
            loading={statusQuery.isFetching}
            onClick={() => void statusQuery.refetch()}
          >
            {MESSAGES.system.action.recheck}
          </Button>
        }
      />

      {statusQuery.isLoading && (
        <LoadingState label={MESSAGES.system.a11y.loading} />
      )}

      {statusQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.system.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => void statusQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          }
        />
      )}

      {status && (
        <>
          <p className="text-foreground-secondary text-[14px] leading-[1.429]">
            {MESSAGES.system.label.checkedAt(formatDateTime(status.checkedAt))}
          </p>

          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
              {MESSAGES.system.heading.dependencies}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <DependencyCard
                label={MESSAGES.system.dependency.database}
                description={MESSAGES.system.dependency.databaseDescription}
                dependency={status.database}
              />
              <DependencyCard
                label={MESSAGES.system.dependency.cache}
                description={MESSAGES.system.dependency.cacheDescription}
                dependency={status.cache}
              />
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-3">
            <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
              {MESSAGES.system.heading.realtime}
            </h2>
            {status.realtime ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <RealtimeCard
                  label={MESSAGES.system.realtime.documents}
                  value={status.realtime.documentCount}
                />
                <RealtimeCard
                  label={MESSAGES.system.realtime.participants}
                  value={status.realtime.participantCount}
                />
                {/* 한 사람이 탭을 여러 개 열면 참여자 1명에 소켓이 여러 개다. */}
                <RealtimeCard
                  label={MESSAGES.system.realtime.sockets}
                  value={status.realtime.socketCount}
                />
              </div>
            ) : (
              /* 0건으로 보여주면 "아무도 안 쓴다"로 읽힌다. 모른다고 적는다. */
              <Card className="gap-1">
                <p className="text-foreground-strong text-[14px] leading-[1.429] font-medium">
                  {MESSAGES.system.realtime.unavailable}
                </p>
                <p className="text-foreground-secondary text-[14px] leading-[1.429]">
                  {MESSAGES.system.realtime.unavailableDescription}
                </p>
              </Card>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export { SystemPage }
