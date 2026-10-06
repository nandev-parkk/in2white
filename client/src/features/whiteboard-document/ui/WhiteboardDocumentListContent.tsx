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
import { Button } from '@in2white/ui/button'
import { EmptyState } from '@in2white/ui/empty-state'
import { ErrorState } from '@in2white/ui/error-state'
import { ListPagination } from '@in2white/ui/list-pagination'
import { DelayedLoading } from '@in2white/ui/loading-state'
import { ResourceListSkeleton } from '@in2white/ui/resource-list-skeleton'
import { Search } from '@in2white/ui/search'
import { toast } from '@in2white/ui/toast'
import { ViewToggle, type ListView } from '@in2white/ui/view-toggle'
import { WhiteboardCard } from '@/shared/ui/whiteboard-card'

import { WhiteboardDocumentDeleteDialog } from './WhiteboardDocumentDeleteDialog'
import { WhiteboardDocumentFormDialog } from './WhiteboardDocumentFormDialog'
import { WhiteboardDocumentMenu } from './WhiteboardDocumentMenu'
import { WhiteboardDocumentTable } from './WhiteboardDocumentTable'
import { MESSAGES } from '@/shared/constants/messages'

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
      toast.success(MESSAGES.whiteboard.toast.created)
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
      toast.success(MESSAGES.whiteboard.toast.renamed)
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
      toast.success(MESSAGES.whiteboard.toast.deleted)
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
          aria-label={MESSAGES.whiteboard.a11y.search}
          placeholder={MESSAGES.whiteboard.form.searchPlaceholder}
          value={search}
          onClear={() => handleSearchChange('')}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="w-full max-w-80"
        />
        <div className="flex items-center gap-2">
          <ViewToggle
            value={view}
            onChange={setView}
            label={MESSAGES.whiteboard.a11y.viewToggle}
          />
          <Button className="h-9" onClick={openCreateDialog}>
            {MESSAGES.whiteboard.action.create}
          </Button>
        </div>
      </div>

      {documentsQuery.isLoading && (
        <DelayedLoading startedAt={loadingStartedAt}>
          <div role="status" aria-label={MESSAGES.whiteboard.a11y.loading}>
            <ResourceListSkeleton view={view} kind="whiteboard" />
          </div>
        </DelayedLoading>
      )}

      {documentsQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.whiteboard.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setLoadingStartedAt(Date.now())
                void documentsQuery.refetch()
              }}
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
            icon={
              hasSearch ? (
                <SearchIcon className="size-8" />
              ) : (
                <PenLine className="size-8" />
              )
            }
            title={
              hasSearch
                ? MESSAGES.common.empty.searchTitle
                : MESSAGES.whiteboard.empty.title
            }
            description={
              hasSearch
                ? MESSAGES.common.empty.searchDescription
                : MESSAGES.whiteboard.empty.description
            }
            action={
              hasSearch ? (
                <Button
                  variant="secondary"
                  onClick={() => handleSearchChange('')}
                >
                  {MESSAGES.common.action.clearSearch}
                </Button>
              ) : (
                <Button size="large" onClick={openCreateDialog}>
                  {MESSAGES.whiteboard.action.createFirst}
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
          title={MESSAGES.whiteboard.action.createFirst}
          submitLabel={MESSAGES.common.action.create}
          onOpenChange={handleCreateOpenChange}
          onSubmit={handleCreate}
          loading={createDocument.isPending}
          error={
            createDocument.error
              ? MESSAGES.whiteboard.error.createFailed
              : undefined
          }
        />
      )}

      {renamingDocument && (
        <WhiteboardDocumentFormDialog
          open
          title={MESSAGES.whiteboard.heading.renameDialog}
          submitLabel={MESSAGES.common.action.save}
          initialName={renamingDocument.name}
          onOpenChange={handleRenameOpenChange}
          onSubmit={handleRename}
          loading={updateDocument.isPending}
          error={
            updateDocument.error
              ? MESSAGES.whiteboard.error.renameFailed
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
          deleteDocument.error
            ? MESSAGES.whiteboard.error.deleteFailed
            : undefined
        }
      />
    </section>
  )
}

export { WhiteboardDocumentListContent }
