import { useState } from 'react'
import { FolderX } from 'lucide-react'

import type { CreateProjectInput } from '@/entities/project'
import type { SessionUser } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'
import {
  isProjectNotFound,
  useDeleteProject,
  useProject,
  useUpdateProject,
} from '@/features/project'
import { ProjectDeleteDialog } from '@/features/project/ui/ProjectDeleteDialog'
import { ProjectDetailHeader } from '@/features/project/ui/ProjectDetailHeader'
import { ProjectFormDialog } from '@/features/project/ui/ProjectFormDialog'
import { WhiteboardDocumentListContent } from '@/features/whiteboard-document'
import { AuthenticatedWorkspaceLayout } from '@/pages/shared/ui/AuthenticatedWorkspaceLayout'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import type { SidebarNavKey } from '@/shared/ui/sidebar'
import { Skeleton } from '@/shared/ui/skeleton'
import { DelayedLoading } from '@/shared/ui/loading-state'
import {
  ListToolbarSkeleton,
  ResourceListSkeleton,
} from '@/shared/ui/resource-list-skeleton'
import { toast } from '@/shared/ui/toast'
import { MESSAGES } from '@/shared/constants/messages'

type ProjectDetailPageProps = {
  onDocumentOpen?: (documentId: string) => void
  workspaceId: string
  projectId: string
  onBack: () => void
  onWorkspaceChange?: (workspaceId: string) => void
  onNavChange?: (key: SidebarNavKey, selectedWorkspaceId: string | null) => void
  onUserClick?: (selectedWorkspaceId: string | null) => void
}

type ProjectDetailContentProps = {
  loadingStartedAt?: number
  onDocumentOpen?: (documentId: string) => void
  accessToken: string
  workspaceId: string
  projectId: string
  user: SessionUser
  selectedWorkspace: WorkspaceSummary | null
  onBack: () => void
}

function ProjectDetailHeaderSkeleton({ startedAt }: { startedAt?: number }) {
  return (
    <DelayedLoading startedAt={startedAt}>
      <div
        data-testid="project-detail-header-skeleton"
        role="status"
        aria-label={MESSAGES.project.a11y.loading}
        className="flex min-w-0 flex-col gap-6"
      >
        <div className="flex h-[130px] flex-col gap-4" aria-hidden="true">
          <Skeleton className="h-4.5 w-40" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <Skeleton className="h-6 w-32" />
        </div>
        <ListToolbarSkeleton />
        <ResourceListSkeleton view="grid" kind="whiteboard" />
      </div>
    </DelayedLoading>
  )
}

function ProjectDetailContent({
  loadingStartedAt,
  accessToken,
  workspaceId,
  projectId,
  user,
  selectedWorkspace,
  onBack,
  onDocumentOpen,
}: ProjectDetailContentProps) {
  const [startedAt, setStartedAt] = useState(
    () => loadingStartedAt ?? Date.now(),
  )
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const projectQuery = useProject(accessToken, workspaceId, projectId)
  const updateProject = useUpdateProject(accessToken, workspaceId)
  const deleteProject = useDeleteProject(accessToken, workspaceId)

  const project = projectQuery.data

  function openEditDialog() {
    updateProject.reset()
    setEditOpen(true)
  }

  function handleEditOpenChange(open: boolean) {
    if (!open && updateProject.isPending) return
    if (!open) updateProject.reset()
    setEditOpen(open)
  }

  async function handleUpdate(input: CreateProjectInput) {
    if (!project) return

    try {
      await updateProject.mutateAsync({ projectId: project.id, input })
      toast.success(MESSAGES.project.toast.updated)
      handleEditOpenChange(false)
    } catch {
      return
    }
  }

  function openDeleteDialog() {
    deleteProject.reset()
    setDeleteOpen(true)
  }

  function handleDeleteOpenChange(open: boolean) {
    if (!open && deleteProject.isPending) return
    if (!open) deleteProject.reset()
    setDeleteOpen(open)
  }

  async function handleDelete() {
    if (!project) return

    try {
      await deleteProject.mutateAsync(project.id)
      toast.success(MESSAGES.project.toast.deleted)
      handleDeleteOpenChange(false)
      onBack()
    } catch {
      return
    }
  }

  if (projectQuery.isLoading)
    return <ProjectDetailHeaderSkeleton startedAt={startedAt} />

  if (projectQuery.isError && isProjectNotFound(projectQuery.error)) {
    return (
      <EmptyState
        className="flex-1"
        icon={<FolderX className="size-8" />}
        title={MESSAGES.project.error.notFound}
        description={MESSAGES.project.error.notFoundDescription}
        action={
          <Button variant="secondary" onClick={onBack}>
            {MESSAGES.project.action.backToList}
          </Button>
        }
      />
    )
  }

  if (projectQuery.isError || !project) {
    return (
      <ErrorState
        className="min-h-48 flex-1"
        title={MESSAGES.project.error.loadFailed}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setStartedAt(Date.now())
              void projectQuery.refetch()
            }}
          >
            {MESSAGES.common.action.retry}
          </Button>
        }
      />
    )
  }

  const canManageProject =
    selectedWorkspace?.role === 'owner' || project.creatorId === user.id

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6">
      <ProjectDetailHeader
        project={project}
        canManage={canManageProject}
        onBack={onBack}
        onEdit={openEditDialog}
        onDelete={openDeleteDialog}
      />

      <WhiteboardDocumentListContent
        loadingStartedAt={startedAt}
        onDocumentOpen={onDocumentOpen}
        accessToken={accessToken}
        workspaceId={workspaceId}
        projectId={projectId}
        userId={user.id}
        workspaceRole={selectedWorkspace?.role}
      />

      {editOpen && (
        <ProjectFormDialog
          open
          title={MESSAGES.project.heading.editDialog}
          submitLabel={MESSAGES.common.action.save}
          initialName={project.name}
          initialDescription={project.description}
          onOpenChange={handleEditOpenChange}
          onSubmit={handleUpdate}
          loading={updateProject.isPending}
          error={
            updateProject.error
              ? MESSAGES.project.error.updateFailed
              : undefined
          }
        />
      )}

      <ProjectDeleteDialog
        open={deleteOpen}
        projectName={project.name}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={() => void handleDelete()}
        loading={deleteProject.isPending}
        error={
          deleteProject.error ? MESSAGES.project.error.deleteFailed : undefined
        }
      />
    </div>
  )
}

function ProjectDetailPage({
  workspaceId,
  projectId,
  onBack,
  onWorkspaceChange,
  onDocumentOpen,
  onNavChange,
  onUserClick,
}: ProjectDetailPageProps) {
  return (
    <AuthenticatedWorkspaceLayout
      key={`${workspaceId}:${projectId}`}
      loadingFallback={(startedAt) => (
        <ProjectDetailHeaderSkeleton startedAt={startedAt} />
      )}
      workspaceId={workspaceId}
      activeNav="projects"
      onWorkspaceChange={onWorkspaceChange}
      onNavChange={onNavChange}
      onUserClick={onUserClick}
    >
      {({ accessToken, selectedWorkspace, user, loadingStartedAt }) => (
        <ProjectDetailContent
          key={`${user.id}:${workspaceId}:${projectId}`}
          loadingStartedAt={loadingStartedAt}
          accessToken={accessToken}
          workspaceId={workspaceId}
          projectId={projectId}
          user={user}
          onDocumentOpen={onDocumentOpen}
          selectedWorkspace={selectedWorkspace}
          onBack={onBack}
        />
      )}
    </AuthenticatedWorkspaceLayout>
  )
}

export { ProjectDetailPage }
