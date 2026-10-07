import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import { useState } from 'react'
import { FileText } from 'lucide-react'

import type { AdminWhiteboardDocument } from '@/entities/whiteboard-document'
import {
  WhiteboardDocumentTable,
  useDeleteWhiteboardDocument,
  useRestoreWhiteboardDocument,
  useWhiteboardDocuments,
} from '@/features/whiteboard-document'
import { MESSAGES } from '@/shared/constants/messages'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { clampPage } from '@/shared/lib/clamp-page'
import type { ResourceStatusFilter } from '@/shared/types/resource-status'
import { Button } from '@in2white/ui/button'
import { ConfirmDialog } from '@in2white/ui/confirm-dialog'
import { EmptyState } from '@in2white/ui/empty-state'
import { ErrorState } from '@in2white/ui/error-state'
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
import { toast } from '@in2white/ui/toast'

const DOCUMENTS_PER_PAGE = 20

const STATUS_OPTIONS: { value: ResourceStatusFilter; label: string }[] = [
  { value: 'all', label: MESSAGES.whiteboardDocument.filter.all },
  { value: 'active', label: MESSAGES.whiteboardDocument.filter.active },
  { value: 'deleted', label: MESSAGES.whiteboardDocument.filter.deleted },
]

type ConfirmTarget = {
  document: AdminWhiteboardDocument
  action: 'delete' | 'restore'
}

/*
 * 프로젝트가 삭제된 문서도 복구한다 — 막지 않고 한계를 알린다. 프로젝트를 먼저 복구할지
 * 문서만 되살려 둘지는 어드민이 판단할 일이다.
 */
function restoreDescription(document: AdminWhiteboardDocument) {
  return document.project.deletedAt === null
    ? MESSAGES.whiteboardDocument.confirm.restore(document.name)
    : MESSAGES.whiteboardDocument.confirm.restoreUnderDeletedProject(
        document.name,
        document.project.name,
      )
}

function WhiteboardDocumentsPage() {
  useDocumentTitle('in2white admin | 화이트보드 문서')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ResourceStatusFilter>('all')
  const [page, setPage] = useState(1)
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)

  const documentsQuery = useWhiteboardDocuments({
    page,
    limit: DOCUMENTS_PER_PAGE,
    search,
    status,
  })
  const deleteDocument = useDeleteWhiteboardDocument()
  const restoreDocument = useRestoreWhiteboardDocument()

  const documents = documentsQuery.data?.whiteboardDocuments ?? []
  const pagination = documentsQuery.data?.pagination

  const validPage = clampPage(
    page,
    pagination?.totalPages,
    !documentsQuery.isPlaceholderData,
  )
  if (validPage !== page) setPage(validPage)

  /*
   * 빈 상태 문구는 "방금 받은 응답"의 조건으로 고른다. 입력 즉시 바꾸면 이전 결과가
   * 남아 있는 동안 검색 결과 없음을 먼저 보여주게 된다.
   */
  const [resultSearch, setResultSearch] = useState(search)
  if (!documentsQuery.isPlaceholderData && resultSearch !== search) {
    setResultSearch(search)
  }
  const hasSearch = resultSearch.trim().length > 0

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleStatusChange(value: string) {
    setStatus(value as ResourceStatusFilter)
    setPage(1)
  }

  function openConfirm(target: ConfirmTarget) {
    const mutation =
      target.action === 'delete' ? deleteDocument : restoreDocument
    mutation.reset()
    setConfirmTarget(target)
  }

  const activeMutation =
    confirmTarget?.action === 'restore' ? restoreDocument : deleteDocument

  async function handleConfirm() {
    if (!confirmTarget) return

    try {
      await activeMutation.mutateAsync(confirmTarget.document.id)
      toast.success(
        confirmTarget.action === 'delete'
          ? MESSAGES.whiteboardDocument.toast.deleted
          : MESSAGES.whiteboardDocument.toast.restored,
      )
      setConfirmTarget(null)
    } catch {
      /* 실패 사유는 모달 안에 남긴다. 닫아버리면 무엇이 막혔는지 알 수 없다. */
      return
    }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      {/* 어드민은 문서를 만들지도 이름을 바꾸지도 않는다 — 감추고 되살리기만 한다. */}
      <PageHeader title={MESSAGES.whiteboardDocument.heading.list} />

      <div className="flex flex-wrap items-center gap-3">
        <Search
          aria-label={MESSAGES.whiteboardDocument.a11y.search}
          placeholder={MESSAGES.whiteboardDocument.search.placeholder}
          value={search}
          onClear={() => handleSearchChange('')}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="w-full max-w-80"
        />
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger
            aria-label={MESSAGES.whiteboardDocument.filter.label}
            className="w-32"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {documentsQuery.isLoading && (
        <LoadingState label={MESSAGES.whiteboardDocument.a11y.loading} />
      )}

      {documentsQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.whiteboardDocument.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => void documentsQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          }
        />
      )}

      {!documentsQuery.isLoading &&
        !documentsQuery.isError &&
        documents.length === 0 && (
          <EmptyState
            className="flex-1 py-8"
            icon={<FileText className="size-8" />}
            title={
              hasSearch
                ? MESSAGES.common.empty.searchTitle
                : MESSAGES.whiteboardDocument.empty.title
            }
            description={
              hasSearch
                ? MESSAGES.common.empty.searchDescription
                : MESSAGES.whiteboardDocument.empty.description
            }
            action={
              hasSearch ? (
                <Button
                  variant="secondary"
                  onClick={() => handleSearchChange('')}
                >
                  {MESSAGES.common.action.clearSearch}
                </Button>
              ) : undefined
            }
          />
        )}

      {!documentsQuery.isLoading &&
        !documentsQuery.isError &&
        documents.length > 0 && (
          <>
            <div className="w-full overflow-x-auto">
              <WhiteboardDocumentTable
                whiteboardDocuments={documents}
                onDelete={(document) =>
                  openConfirm({ document, action: 'delete' })
                }
                onRestore={(document) =>
                  openConfirm({ document, action: 'restore' })
                }
              />
            </div>
            {pagination && (
              <ListPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                disabled={documentsQuery.isFetching}
                onPageChange={setPage}
              />
            )}
          </>
        )}

      {confirmTarget && (
        <ConfirmDialog
          open
          /* 복구는 되돌릴 수 있다. 파괴적 색은 소프트 삭제에만 쓴다. */
          destructive={confirmTarget.action === 'delete'}
          title={
            confirmTarget.action === 'delete'
              ? MESSAGES.whiteboardDocument.heading.delete
              : MESSAGES.whiteboardDocument.heading.restore
          }
          description={
            confirmTarget.action === 'delete'
              ? MESSAGES.whiteboardDocument.confirm.delete(
                  confirmTarget.document.name,
                )
              : restoreDescription(confirmTarget.document)
          }
          confirmLabel={
            confirmTarget.action === 'delete'
              ? MESSAGES.whiteboardDocument.action.delete
              : MESSAGES.whiteboardDocument.action.restore
          }
          onOpenChange={(open) => {
            if (!open && !activeMutation.isPending) setConfirmTarget(null)
          }}
          onConfirm={() => void handleConfirm()}
          loading={activeMutation.isPending}
          error={
            activeMutation.error
              ? apiErrorMessage(activeMutation.error)
              : undefined
          }
        />
      )}
    </section>
  )
}

export { WhiteboardDocumentsPage }
