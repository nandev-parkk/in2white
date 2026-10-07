import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FolderKanban } from 'lucide-react'

import type { AdminWorkspaceListItem } from '@/entities/workspace'
import { WorkspaceTable, useWorkspaces } from '@/features/workspace'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import { EmptyState } from '@in2white/ui/empty-state'
import { ErrorState } from '@in2white/ui/error-state'
import { ListPagination } from '@in2white/ui/list-pagination'
import { LoadingState } from '@in2white/ui/loading-state'
import { PageHeader } from '@in2white/ui/page-header'
import { Search } from '@in2white/ui/search'

const WORKSPACES_PER_PAGE = 20

function WorkspacesPage() {
  useDocumentTitle('in2white admin | 워크스페이스')

  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const workspacesQuery = useWorkspaces({
    page,
    limit: WORKSPACES_PER_PAGE,
    search,
  })

  const workspaces = workspacesQuery.data?.workspaces ?? []
  const pagination = workspacesQuery.data?.pagination

  /*
   * 빈 상태 문구는 "방금 받은 응답"의 조건으로 고른다. 입력 즉시 바꾸면 이전 결과가
   * 남아 있는 동안 검색 결과 없음을 먼저 보여주게 된다.
   */
  const [resultSearch, setResultSearch] = useState(search)
  if (!workspacesQuery.isPlaceholderData && resultSearch !== search) {
    setResultSearch(search)
  }
  const hasSearch = resultSearch.trim().length > 0

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleSelect(workspace: AdminWorkspaceListItem) {
    void navigate({
      to: '/workspaces/$workspaceId',
      params: { workspaceId: workspace.id },
    })
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      {/* 어드민은 워크스페이스를 만들지 않는다 — 생성 버튼을 두지 않는 이유다. */}
      <PageHeader title={MESSAGES.workspace.heading.list} />

      <Search
        aria-label={MESSAGES.workspace.a11y.search}
        placeholder={MESSAGES.workspace.search.placeholder}
        value={search}
        onClear={() => handleSearchChange('')}
        onChange={(event) => handleSearchChange(event.target.value)}
        className="w-full max-w-80"
      />

      {workspacesQuery.isLoading && (
        <LoadingState label={MESSAGES.workspace.a11y.loading} />
      )}

      {workspacesQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.workspace.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => void workspacesQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          }
        />
      )}

      {!workspacesQuery.isLoading &&
        !workspacesQuery.isError &&
        workspaces.length === 0 && (
          <EmptyState
            className="flex-1 py-8"
            icon={<FolderKanban className="size-8" />}
            title={
              hasSearch
                ? MESSAGES.common.empty.searchTitle
                : MESSAGES.workspace.empty.title
            }
            description={
              hasSearch
                ? MESSAGES.common.empty.searchDescription
                : MESSAGES.workspace.empty.description
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

      {!workspacesQuery.isLoading &&
        !workspacesQuery.isError &&
        workspaces.length > 0 && (
          <>
            <div className="w-full overflow-x-auto">
              <WorkspaceTable workspaces={workspaces} onSelect={handleSelect} />
            </div>
            {pagination && (
              <ListPagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                disabled={workspacesQuery.isFetching}
                onPageChange={setPage}
              />
            )}
          </>
        )}
    </section>
  )
}

export { WorkspacesPage }
