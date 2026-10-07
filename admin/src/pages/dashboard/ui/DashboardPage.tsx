import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import {
  MetricCard,
  TrendChart,
  useDashboardMetrics,
} from '@/features/dashboard'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import { ErrorState } from '@in2white/ui/error-state'
import { LoadingState } from '@in2white/ui/loading-state'
import { PageHeader } from '@in2white/ui/page-header'

function DashboardPage() {
  useDocumentTitle('in2white admin | 대시보드')

  const metricsQuery = useDashboardMetrics()
  const metrics = metricsQuery.data

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      <PageHeader title={MESSAGES.dashboard.heading.page} />

      {metricsQuery.isLoading && (
        <LoadingState label={MESSAGES.dashboard.a11y.loading} />
      )}

      {metricsQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.dashboard.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => void metricsQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          }
        />
      )}

      {metrics && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={MESSAGES.dashboard.metric.users}
              value={metrics.totals.users.total}
              detail={MESSAGES.dashboard.detail.deactivated(
                metrics.totals.users.deactivated,
              )}
            />
            {/* 워크스페이스는 하드 삭제라 남아 있는 수가 곧 전체다. */}
            <MetricCard
              label={MESSAGES.dashboard.metric.workspaces}
              value={metrics.totals.workspaces.total}
            />
            <MetricCard
              label={MESSAGES.dashboard.metric.projects}
              value={metrics.totals.projects.total}
              detail={MESSAGES.dashboard.detail.deleted(
                metrics.totals.projects.deleted,
              )}
            />
            <MetricCard
              label={MESSAGES.dashboard.metric.whiteboardDocuments}
              value={metrics.totals.whiteboardDocuments.total}
              detail={MESSAGES.dashboard.detail.deleted(
                metrics.totals.whiteboardDocuments.deleted,
              )}
            />
          </div>

          <TrendChart trend={metrics.trend} />
        </>
      )}
    </section>
  )
}

export { DashboardPage }
