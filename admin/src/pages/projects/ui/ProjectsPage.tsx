import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FolderKanban } from 'lucide-react'

import type { AdminProjectListItem } from '@/entities/project'
import {
  ProjectTable,
  useDeleteProject,
  useProjects,
  useRestoreProject,
} from '@/features/project'
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

const PROJECTS_PER_PAGE = 20

/* 기본값은 전체다. 삭제된 프로젝트를 감추면 복구 대상을 찾을 수 없다. */
const STATUS_OPTIONS: { value: ResourceStatusFilter; label: string }[] = [
  { value: 'all', label: MESSAGES.project.filter.all },
  { value: 'active', label: MESSAGES.project.filter.active },
  { value: 'deleted', label: MESSAGES.project.filter.deleted },
]

type ConfirmTarget = {
  project: AdminProjectListItem
  action: 'delete' | 'restore'
}

function ProjectsPage() {
  useDocumentTitle('in2white admin | 프로젝트')

  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ResourceStatusFilter>('all')
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null)

  const [page, setPage] = useState(1)

  const projectsQuery = useProjects({
    page,
    limit: PROJECTS_PER_PAGE,
    search,
    status,
  })
  const deleteProject = useDeleteProject()
  const restoreProject = useRestoreProject()

  const projects = projectsQuery.data?.projects ?? []
  const pagination = projectsQuery.data?.pagination

  const validPage = clampPage(
    page,
    pagination?.totalPages,
    !projectsQuery.isPlaceholderData,
  )
  if (validPage !== page) setPage(validPage)

  /*
   * 빈 상태 문구는 "방금 받은 응답"의 조건으로 고른다. 입력 즉시 바꾸면 이전 결과가
   * 남아 있는 동안 검색 결과 없음을 먼저 보여주게 된다.
   */
  const [resultSearch, setResultSearch] = useState(search)
  if (!projectsQuery.isPlaceholderData && resultSearch !== search) {
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
    const mutation = target.action === 'delete' ? deleteProject : restoreProject
    mutation.reset()
    setConfirmTarget(target)
  }

  const activeMutation =
    confirmTarget?.action === 'restore' ? restoreProject : deleteProject

  async function handleConfirm() {
    if (!confirmTarget) return

    try {
      await activeMutation.mutateAsync(confirmTarget.project.id)
      toast.success(
        confirmTarget.action === 'delete'
          ? MESSAGES.project.toast.deleted
          : MESSAGES.project.toast.restored,
      )
      setConfirmTarget(null)
    } catch {
      /* 실패 사유는 모달 안에 남긴다. 닫아버리면 무엇이 막혔는지 알 수 없다. */
      return
    }
  }

  function handleSelect(project: AdminProjectListItem) {
    void navigate({
      to: '/projects/$projectId',
      params: { projectId: project.id },
    })
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      {/* 어드민은 프로젝트를 만들지 않는다 — 생성 버튼을 두지 않는 이유다. */}
      <PageHeader title={MESSAGES.project.heading.list} />

      <div className="flex flex-wrap items-center gap-3">
        <Search
          aria-label={MESSAGES.project.a11y.search}
          placeholder={MESSAGES.project.search.placeholder}
          value={search}
          onClear={() => handleSearchChange('')}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="w-full max-w-80"
        />
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger
            aria-label={MESSAGES.project.filter.label}
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

      {projectsQuery.isLoading && (
        <LoadingState label={MESSAGES.project.a11y.loading} />
      )}

      {projectsQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.project.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => void projectsQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          }
        />
      )}

      {!projectsQuery.isLoading &&
        !projectsQuery.isError &&
        projects.length === 0 && (
          <EmptyState
            className="flex-1 py-8"
            icon={<FolderKanban className="size-8" />}
            title={
              hasSearch
                ? MESSAGES.common.empty.searchTitle
                : MESSAGES.project.empty.title
            }
            description={
              hasSearch
                ? MESSAGES.common.empty.searchDescription
                : MESSAGES.project.empty.description
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

      {!projectsQuery.isLoading &&
        !projectsQuery.isError &&
        projects.length > 0 && (
          <>
            <div className="w-full overflow-x-auto">
              <ProjectTable
                projects={projects}
                onSelect={handleSelect}
                onDelete={(project) =>
                  openConfirm({ project, action: 'delete' })
                }
                onRestore={(project) =>
                  openConfirm({ project, action: 'restore' })
                }
              />
            </div>
            {pagination && (
              <ListPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                disabled={projectsQuery.isFetching}
                onPageChange={setPage}
              />
            )}
          </>
        )}

      {confirmTarget && (
        <ConfirmDialog
          open
          /* 소프트 삭제라 복구할 수 있다. 삭제 문구에서 하드 삭제와 구분한다. */
          destructive={confirmTarget.action === 'delete'}
          title={
            confirmTarget.action === 'delete'
              ? MESSAGES.project.heading.delete
              : MESSAGES.project.heading.restore
          }
          description={
            confirmTarget.action === 'delete'
              ? MESSAGES.project.confirm.delete(confirmTarget.project.name)
              : MESSAGES.project.confirm.restore(confirmTarget.project.name)
          }
          confirmLabel={
            confirmTarget.action === 'delete'
              ? MESSAGES.project.action.delete
              : MESSAGES.project.action.restore
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

export { ProjectsPage }
