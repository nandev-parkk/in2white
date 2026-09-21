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
import type { SidebarNavKey } from '@/shared/ui/sidebar'
import { Skeleton } from '@/shared/ui/skeleton'
import { toast } from '@/shared/ui/toast'

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
  onDocumentOpen?: (documentId: string) => void
  accessToken: string
  workspaceId: string
  projectId: string
  user: SessionUser
  selectedWorkspace: WorkspaceSummary | null
  onBack: () => void
}

function ProjectDetailHeaderSkeleton() {
  return (
    <div
      data-testid="project-detail-header-skeleton"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-4.5 w-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-5 w-96" />
      </div>
      <Skeleton className="h-6 w-32" />
    </div>
  )
}

function ProjectDetailContent({
  accessToken,
  workspaceId,
  projectId,
  user,
  selectedWorkspace,
  onBack,
  onDocumentOpen,
}: ProjectDetailContentProps) {
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
      toast.success('프로젝트를 수정했어요')
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
      toast.success('프로젝트를 삭제했어요')
      handleDeleteOpenChange(false)
      onBack()
    } catch {
      return
    }
  }

  if (projectQuery.isLoading) return <ProjectDetailHeaderSkeleton />

  if (projectQuery.isError && isProjectNotFound(projectQuery.error)) {
    return (
      <EmptyState
        className="flex-1"
        icon={<FolderX className="size-8" />}
        title="프로젝트를 찾을 수 없어요"
        description="삭제되었거나 접근할 수 없는 프로젝트예요"
        action={
          <Button variant="secondary" onClick={onBack}>
            프로젝트 목록으로
          </Button>
        }
      />
    )
  }

  if (projectQuery.isError || !project) {
    return (
      <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-4">
        <p className="text-body text-foreground-secondary">
          프로젝트를 불러오지 못했어요
        </p>
        <Button variant="secondary" onClick={() => void projectQuery.refetch()}>
          다시 시도
        </Button>
      </div>
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
          title="프로젝트 수정"
          submitLabel="저장"
          initialName={project.name}
          initialDescription={project.description}
          onOpenChange={handleEditOpenChange}
          onSubmit={handleUpdate}
          loading={updateProject.isPending}
          error={
            updateProject.error ? '프로젝트를 수정하지 못했어요' : undefined
          }
        />
      )}

      <ProjectDeleteDialog
        open={deleteOpen}
        projectName={project.name}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={() => void handleDelete()}
        loading={deleteProject.isPending}
        error={deleteProject.error ? '프로젝트를 삭제하지 못했어요' : undefined}
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
      workspaceId={workspaceId}
      activeNav="projects"
      onWorkspaceChange={onWorkspaceChange}
      onNavChange={onNavChange}
      onUserClick={onUserClick}
    >
      {({ accessToken, selectedWorkspace, user }) => (
        <ProjectDetailContent
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
