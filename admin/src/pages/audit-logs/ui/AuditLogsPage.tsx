import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import { useState } from 'react'
import { ScrollText, X } from 'lucide-react'

import type {
  AdminAuditLog,
  AdminAuditLogAdmin,
  AuditTargetType,
} from '@/entities/audit-log'
import {
  AuditLogDetailDialog,
  AuditLogTable,
  useAuditLogs,
} from '@/features/audit-log'
import { MESSAGES } from '@/shared/constants/messages'
import { clampPage } from '@/shared/lib/clamp-page'
import { Badge } from '@in2white/ui/badge'
import { Button } from '@in2white/ui/button'
import { EmptyState } from '@in2white/ui/empty-state'
import { ErrorState } from '@in2white/ui/error-state'
import { Input } from '@in2white/ui/input'
import { ListPagination } from '@in2white/ui/list-pagination'
import { LoadingState } from '@in2white/ui/loading-state'
import { PageHeader } from '@in2white/ui/page-header'
import { Search } from '@in2white/ui/search'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@in2white/ui/select'

const AUDIT_LOGS_PER_PAGE = 20

type TargetTypeFilter = AuditTargetType | 'all'

const TARGET_TYPE_OPTIONS: { value: TargetTypeFilter; label: string }[] = [
  { value: 'all', label: MESSAGES.auditLog.filter.all },
  { value: 'user', label: MESSAGES.auditLog.targetType.user },
  { value: 'workspace', label: MESSAGES.auditLog.targetType.workspace },
  { value: 'project', label: MESSAGES.auditLog.targetType.project },
  {
    value: 'whiteboard_document',
    label: MESSAGES.auditLog.targetType.whiteboard_document,
  },
  { value: 'admin', label: MESSAGES.auditLog.targetType.admin },
]

function AuditLogsPage() {
  useDocumentTitle('in2white admin | 감사 로그')

  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState<TargetTypeFilter>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  /*
   * 어드민 목록 API가 없다. 표에서 누른 어드민을 그대로 들고 있어야 필터 칩에 이름을
   * 보여줄 수 있다 — uuid만 들고 있으면 누구를 거르는지 알 수 없다.
   */
  const [adminFilter, setAdminFilter] = useState<AdminAuditLogAdmin | null>(
    null,
  )
  const [page, setPage] = useState(1)
  const [detailTarget, setDetailTarget] = useState<AdminAuditLog | null>(null)

  const auditLogsQuery = useAuditLogs({
    page,
    limit: AUDIT_LOGS_PER_PAGE,
    action,
    targetType: targetType === 'all' ? undefined : targetType,
    from: from || undefined,
    to: to || undefined,
    adminId: adminFilter?.id,
  })

  const auditLogs = auditLogsQuery.data?.auditLogs ?? []
  const pagination = auditLogsQuery.data?.pagination

  const validPage = clampPage(
    page,
    pagination?.totalPages,
    !auditLogsQuery.isPlaceholderData,
  )
  if (validPage !== page) setPage(validPage)

  /*
   * 빈 상태 문구는 "방금 받은 응답"의 조건으로 고른다. 입력 즉시 바꾸면 이전 결과가
   * 남아 있는 동안 조건 탓이라는 안내를 먼저 보여주게 된다.
   */
  const hasFilter = Boolean(
    action.trim() || targetType !== 'all' || from || to || adminFilter,
  )
  const [resultHasFilter, setResultHasFilter] = useState(hasFilter)
  if (!auditLogsQuery.isPlaceholderData && resultHasFilter !== hasFilter) {
    setResultHasFilter(hasFilter)
  }

  /* 조건이 바뀌면 결과 수가 달라진다. 보고 있던 페이지 번호는 의미가 없어진다. */
  function changeFilter(apply: () => void) {
    apply()
    setPage(1)
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      {/* 감사 로그는 읽기 전용이다 — 어드민이 자기 기록을 지울 수 있으면 의미가 없다. */}
      <PageHeader title={MESSAGES.auditLog.heading.list} />

      <div className="flex flex-wrap items-center gap-3">
        <Search
          aria-label={MESSAGES.auditLog.a11y.search}
          placeholder={MESSAGES.auditLog.search.placeholder}
          value={action}
          onClear={() => changeFilter(() => setAction(''))}
          onChange={(event) =>
            changeFilter(() => setAction(event.target.value))
          }
          className="w-full max-w-80"
        />
        <Select
          value={targetType}
          onValueChange={(value) =>
            changeFilter(() => setTargetType(value as TargetTypeFilter))
          }
        >
          <SelectTrigger
            aria-label={MESSAGES.auditLog.filter.targetTypeLabel}
            className="w-44"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TARGET_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label={MESSAGES.auditLog.filter.from}
          value={from}
          onChange={(event) => changeFilter(() => setFrom(event.target.value))}
          className="w-40"
        />
        <Input
          type="date"
          aria-label={MESSAGES.auditLog.filter.to}
          value={to}
          onChange={(event) => changeFilter(() => setTo(event.target.value))}
          className="w-40"
        />
        {adminFilter && (
          <div className="flex items-center gap-1">
            <Badge semantic="info">
              {MESSAGES.auditLog.filter.admin(adminFilter.name)}
            </Badge>
            <Button
              variant="ghost"
              aria-label={MESSAGES.auditLog.filter.clearAdmin}
              className="size-8 px-0"
              onClick={() => changeFilter(() => setAdminFilter(null))}
            >
              <X aria-hidden />
            </Button>
          </div>
        )}
      </div>

      {auditLogsQuery.isLoading && (
        <LoadingState label={MESSAGES.auditLog.a11y.loading} />
      )}

      {auditLogsQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.auditLog.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => void auditLogsQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          }
        />
      )}

      {!auditLogsQuery.isLoading &&
        !auditLogsQuery.isError &&
        auditLogs.length === 0 && (
          <EmptyState
            className="flex-1 py-8"
            icon={<ScrollText className="size-8" />}
            title={
              resultHasFilter
                ? MESSAGES.auditLog.empty.filteredTitle
                : MESSAGES.auditLog.empty.title
            }
            description={
              resultHasFilter
                ? MESSAGES.auditLog.empty.filteredDescription
                : MESSAGES.auditLog.empty.description
            }
          />
        )}

      {!auditLogsQuery.isLoading &&
        !auditLogsQuery.isError &&
        auditLogs.length > 0 && (
          <>
            <div className="w-full overflow-x-auto">
              <AuditLogTable
                auditLogs={auditLogs}
                onFilterAdmin={(auditLog) =>
                  changeFilter(() => setAdminFilter(auditLog.admin))
                }
                onSelectDetail={setDetailTarget}
              />
            </div>
            {pagination && (
              <ListPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                disabled={auditLogsQuery.isFetching}
                onPageChange={setPage}
              />
            )}
          </>
        )}

      {detailTarget && (
        <AuditLogDetailDialog
          auditLog={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}
    </section>
  )
}

export { AuditLogsPage }
