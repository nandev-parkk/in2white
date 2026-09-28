import { useState } from 'react'
import { PenLine, Search as SearchIcon } from 'lucide-react'

import type {
  WhiteboardDocument,
  WhiteboardDocumentInput,
} from '@/entities/whiteboard-document'
import type { WorkspaceRole } from '@/entities/workspace'
import {
  useCreateWhiteboardDocument,
  useDeleteWhiteboardDocument,
  useUpdateWhiteboardDocument,
  useWhiteboardDocuments,
} from '@/features/whiteboard-document'
import { formatCreatedAt, formatUpdatedAt } from '@/shared/lib/resource-date'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { ListPagination } from '@/shared/ui/list-pagination'
import { DelayedLoading } from '@/shared/ui/loading-state'
import { ResourceListSkeleton } from '@/shared/ui/resource-list-skeleton'
import { Search } from '@/shared/ui/search'
import { toast } from '@/shared/ui/toast'
import { ViewToggle, type ListView } from '@/shared/ui/view-toggle'
import { WhiteboardCard } from '@/shared/ui/whiteboard-card'

import { WhiteboardDocumentDeleteDialog } from './WhiteboardDocumentDeleteDialog'
import { WhiteboardDocumentFormDialog } from './WhiteboardDocumentFormDialog'
import { WhiteboardDocumentMenu } from './WhiteboardDocumentMenu'
import { WhiteboardDocumentTable } from './WhiteboardDocumentTable'

const DOCUMENTS_PER_PAGE = 12

type WhiteboardDocumentListContentProps = {
  loadingStartedAt?: number
  accessToken: string
  workspaceId: string
  projectId: string
  userId: string
  workspaceRole?: WorkspaceRole
  onDocumentOpen?: (documentId: string) => void
}

function WhiteboardDocumentListContent({
  loadingStartedAt: initialLoadingStartedAt,
  accessToken,
  workspaceId,
  projectId,
  userId,
  workspaceRole,
  onDocumentOpen,
}: WhiteboardDocumentListContentProps) {
  const [loadingStartedAt, setLoadingStartedAt] = useState(
    initialLoadingStartedAt,
  )
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<ListView>('grid')
  const [createOpen, setCreateOpen] = useState(false)
  const [renamingDocument, setRenamingDocument] =
    useState<WhiteboardDocument | null>(null)
  const [deletingDocument, setDeletingDocument] =
    useState<WhiteboardDocument | null>(null)

  const documentsQuery = useWhiteboardDocuments(
    accessToken,
    workspaceId,
    projectId,
    { page, limit: DOCUMENTS_PER_PAGE, search },
  )
  const createDocument = useCreateWhiteboardDocument(
    accessToken,
    workspaceId,
    projectId,
  )
  const updateDocument = useUpdateWhiteboardDocument(
    accessToken,
    workspaceId,
    projectId,
  )
  const deleteDocument = useDeleteWhiteboardDocument(
    accessToken,
    workspaceId,
    projectId,
  )

  const documents = documentsQuery.data?.whiteboardDocuments ?? []
  const pagination = documentsQuery.data?.pagination
  const [resultSearch, setResultSearch] = useState(search)
  if (!documentsQuery.isPlaceholderData && resultSearch !== search) {
    setResultSearch(search)
  }
  const hasSearch = resultSearch.trim().length > 0
  const canManageDocument = (document: WhiteboardDocument) =>
    workspaceRole === 'owner' || document.creatorId === userId

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function openCreateDialog() {
    createDocument.reset()
    setCreateOpen(true)
  }

  function handleCreateOpenChange(open: boolean) {
    if (!open && createDocument.isPending) return
    if (!open) createDocument.reset()
    setCreateOpen(open)
  }

  async function handleCreate(input: WhiteboardDocumentInput) {
    try {
      await createDocument.mutateAsync(input)
      toast.success('화이트보드를 만들었어요')
      handleCreateOpenChange(false)
    } catch {
      return
    }
  }

  function openRenameDialog(document: WhiteboardDocument) {
    updateDocument.reset()
    setRenamingDocument(document)
  }

  function handleRenameOpenChange(open: boolean) {
    if (!open && updateDocument.isPending) return
    if (!open) {
      updateDocument.reset()
      setRenamingDocument(null)
    }
  }

  async function handleRename(input: WhiteboardDocumentInput) {
    if (!renamingDocument) return

    try {
      await updateDocument.mutateAsync({
        documentId: renamingDocument.id,
        input,
      })
      toast.success('화이트보드 이름을 변경했어요')
      handleRenameOpenChange(false)
    } catch {
      return
    }
  }

  function openDeleteDialog(document: WhiteboardDocument) {
    deleteDocument.reset()
    setDeletingDocument(document)
  }

  function handleDeleteOpenChange(open: boolean) {
    if (!open && deleteDocument.isPending) return
    if (!open) {
      deleteDocument.reset()
      setDeletingDocument(null)
    }
  }

  async function handleDelete() {
    if (!deletingDocument) return

    try {
      await deleteDocument.mutateAsync(deletingDocument.id)
      toast.success('화이트보드를 삭제했어요')
      if (documents.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1))
      }
      handleDeleteOpenChange(false)
    } catch {
      return
    }
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Search
          aria-label="화이트보드 검색"
          placeholder="화이트보드 이름으로 검색"
          value={search}
          onClear={() => handleSearchChange('')}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="w-full max-w-80"
        />
        <div className="flex items-center gap-2">
          <ViewToggle
            value={view}
            onChange={setView}
            label="화이트보드 보기 방식"
          />
          <Button className="h-9" onClick={openCreateDialog}>
            화이트보드 생성
          </Button>
        </div>
      </div>

      {documentsQuery.isLoading && (
        <DelayedLoading startedAt={loadingStartedAt}>
          <div role="status" aria-label="화이트보드를 불러오는 중">
            <ResourceListSkeleton view={view} kind="whiteboard" />
          </div>
        </DelayedLoading>
      )}

      {documentsQuery.isError && (
        <ErrorState
          className="min-h-48"
          title="화이트보드를 불러오지 못했어요"
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setLoadingStartedAt(Date.now())
                void documentsQuery.refetch()
              }}
            >
              다시 시도
            </Button>
          }
        />
      )}

      {!documentsQuery.isLoading &&
        !documentsQuery.isError &&
        documents.length === 0 && (
          <EmptyState
            className="flex-1 py-8"
            icon={
              hasSearch ? (
                <SearchIcon className="size-8" />
              ) : (
                <PenLine className="size-8" />
              )
            }
            title={
              hasSearch ? '검색 결과가 없어요' : '아직 화이트보드가 없어요'
            }
            description={
              hasSearch
                ? '다른 검색어로 다시 시도해보세요'
                : '새 화이트보드를 만들어 팀과 함께 아이디어를 그려보세요'
            }
            action={
              hasSearch ? (
                <Button
                  variant="secondary"
                  onClick={() => handleSearchChange('')}
                >
                  검색 결과 초기화
                </Button>
              ) : (
                <Button size="large" onClick={openCreateDialog}>
                  새 화이트보드 만들기
                </Button>
              )
            }
          />
        )}

      {!documentsQuery.isLoading &&
        !documentsQuery.isError &&
        documents.length > 0 && (
          <>
            {view === 'grid' ? (
              <div
                data-testid="whiteboard-document-grid"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1360px]:grid-cols-4"
              >
                {documents.map((document) => (
                  <WhiteboardCard
                    key={document.id}
                    title={document.name}
                    onOpen={
                      onDocumentOpen
                        ? () => onDocumentOpen(document.id)
                        : undefined
                    }
                    createdAtLabel={formatCreatedAt(document.createdAt)}
                    updatedAtLabel={formatUpdatedAt(document.updatedAt)}
                    creatorName={document.creator.name}
                    menu={
                      canManageDocument(document) ? (
                        <WhiteboardDocumentMenu
                          document={document}
                          onRename={openRenameDialog}
                          onDelete={openDeleteDialog}
                        />
                      ) : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <WhiteboardDocumentTable
                documents={documents}
                onOpen={onDocumentOpen}
                onRename={openRenameDialog}
                onDelete={openDeleteDialog}
                canManage={canManageDocument}
              />
            )}

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

      {createOpen && (
        <WhiteboardDocumentFormDialog
          open
          title="새 화이트보드 만들기"
          submitLabel="만들기"
          onOpenChange={handleCreateOpenChange}
          onSubmit={handleCreate}
          loading={createDocument.isPending}
          error={
            createDocument.error ? '화이트보드를 만들지 못했어요' : undefined
          }
        />
      )}

      {renamingDocument && (
        <WhiteboardDocumentFormDialog
          open
          title="화이트보드 이름 변경"
          submitLabel="저장"
          initialName={renamingDocument.name}
          onOpenChange={handleRenameOpenChange}
          onSubmit={handleRename}
          loading={updateDocument.isPending}
          error={
            updateDocument.error
              ? '화이트보드 이름을 변경하지 못했어요'
              : undefined
          }
        />
      )}

      <WhiteboardDocumentDeleteDialog
        open={Boolean(deletingDocument)}
        documentName={deletingDocument?.name ?? ''}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={() => void handleDelete()}
        loading={deleteDocument.isPending}
        error={
          deleteDocument.error ? '화이트보드를 삭제하지 못했어요' : undefined
        }
      />
    </section>
  )
}

export { WhiteboardDocumentListContent }
