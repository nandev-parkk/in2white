import { useState } from 'react'
import { Folder, Search as SearchIcon } from 'lucide-react'

import type { Project } from '@/entities/project'
import type { WorkspaceRole } from '@/entities/workspace'
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/features/project'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { ListPagination } from '@/shared/ui/list-pagination'
import { DelayedLoading } from '@/shared/ui/loading-state'
import { ResourceListSkeleton } from '@/shared/ui/resource-list-skeleton'
import { Search } from '@/shared/ui/search'
import { toast } from '@/shared/ui/toast'
import { ViewToggle, type ListView } from '@/shared/ui/view-toggle'

import { ProjectCard } from './ProjectCard'
import { ProjectDeleteDialog } from './ProjectDeleteDialog'
import { ProjectFormDialog } from './ProjectFormDialog'
import { ProjectTable } from './ProjectTable'
import { MESSAGES } from '@/shared/constants/messages'

const PROJECTS_PER_PAGE = 12

type ProjectListContentProps = {
  loadingStartedAt?: number
  accessToken: string
  workspaceId: string
  userId: string
  workspaceRole?: WorkspaceRole
  onProjectOpen?: (projectId: string) => void
}

function ProjectListContent({
  loadingStartedAt: initialLoadingStartedAt,
  accessToken,
  workspaceId,
  userId,
  workspaceRole,
  onProjectOpen,
}: ProjectListContentProps) {
  const [loadingStartedAt, setLoadingStartedAt] = useState(
    initialLoadingStartedAt,
  )
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [view, setView] = useState<ListView>('grid')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [deletingProject, setDeletingProject] = useState<Project | null>(null)

  const projectsQuery = useProjects(accessToken, workspaceId, {
    page,
    limit: PROJECTS_PER_PAGE,
    search,
  })
  const createProject = useCreateProject(accessToken, workspaceId)
  const updateProject = useUpdateProject(accessToken, workspaceId)
  const deleteProject = useDeleteProject(accessToken, workspaceId)

  const projects = projectsQuery.data?.projects ?? []
  const pagination = projectsQuery.data?.pagination
  const [resultSearch, setResultSearch] = useState(search)
  if (!projectsQuery.isPlaceholderData && resultSearch !== search) {
    setResultSearch(search)
  }
  const hasSearch = resultSearch.trim().length > 0
  const canManageProject = (project: Project) =>
    workspaceRole === 'owner' || project.creatorId === userId
  const handleProjectOpen = onProjectOpen
    ? (project: Project) => onProjectOpen(project.id)
    : undefined

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function openCreateDialog() {
    createProject.reset()
    setCreateOpen(true)
  }

  function handleCreateOpenChange(open: boolean) {
    if (!open && createProject.isPending) return
    if (!open) createProject.reset()
    setCreateOpen(open)
  }

  async function handleCreate(input: {
    name: string
    description: string | null
  }) {
    try {
      await createProject.mutateAsync(input)
      toast.success(MESSAGES.project.toast.created)
      handleCreateOpenChange(false)
    } catch {
      return
    }
  }

  function openEditDialog(project: Project) {
    updateProject.reset()
    setEditingProject(project)
  }

  function handleEditOpenChange(open: boolean) {
    if (!open && updateProject.isPending) return
    if (!open) {
      updateProject.reset()
      setEditingProject(null)
    }
  }

  async function handleUpdate(input: {
    name: string
    description: string | null
  }) {
    if (!editingProject) return

    try {
      await updateProject.mutateAsync({
        projectId: editingProject.id,
        input,
      })
      toast.success(MESSAGES.project.toast.updated)
      handleEditOpenChange(false)
    } catch {
      return
    }
  }

  function openDeleteDialog(project: Project) {
    deleteProject.reset()
    setDeletingProject(project)
  }

  function handleDeleteOpenChange(open: boolean) {
    if (!open && deleteProject.isPending) return
    if (!open) {
      deleteProject.reset()
      setDeletingProject(null)
    }
  }

  async function handleDelete() {
    if (!deletingProject) return

    try {
      await deleteProject.mutateAsync(deletingProject.id)
      toast.success(MESSAGES.project.toast.deleted)
      if (projects.length === 1 && page > 1) {
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
        <h1 className="text-heading1 text-foreground-strong">
          {MESSAGES.project.heading.list}
        </h1>
      </div>

      {!(
        projectsQuery.isSuccess &&
        projects.length === 0 &&
        !hasSearch &&
        page === 1
      ) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Search
            aria-label={MESSAGES.project.a11y.search}
            placeholder={MESSAGES.project.form.searchPlaceholder}
            value={search}
            onClear={() => handleSearchChange('')}
            onChange={(event) => handleSearchChange(event.target.value)}
            className="w-full max-w-80"
          />
          <div className="flex items-center gap-2">
            <ViewToggle
              value={view}
              onChange={setView}
              label={MESSAGES.project.a11y.viewToggle}
            />
            <Button className="h-9" onClick={openCreateDialog}>
              {MESSAGES.project.action.create}
            </Button>
          </div>
        </div>
      )}

      {projectsQuery.isLoading && (
        <DelayedLoading startedAt={loadingStartedAt}>
          <div role="status" aria-label={MESSAGES.project.a11y.loading}>
            <ResourceListSkeleton view={view} kind="project" />
          </div>
        </DelayedLoading>
      )}

      {projectsQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.project.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setLoadingStartedAt(Date.now())
                void projectsQuery.refetch()
              }}
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
            icon={
              hasSearch ? (
                <SearchIcon className="size-8" />
              ) : (
                <Folder className="size-8" />
              )
            }
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
              ) : (
                <Button size="large" onClick={openCreateDialog}>
                  {MESSAGES.project.action.createFirst}
                </Button>
              )
            }
          />
        )}

      {!projectsQuery.isLoading &&
        !projectsQuery.isError &&
        projects.length > 0 && (
          <>
            {view === 'grid' ? (
              <div
                data-testid="project-grid"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1360px]:grid-cols-4"
              >
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={openEditDialog}
                    onDelete={openDeleteDialog}
                    canManage={canManageProject(project)}
                    onOpen={handleProjectOpen}
                  />
                ))}
              </div>
            ) : (
              <ProjectTable
                projects={projects}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
                canManage={canManageProject}
                onOpen={handleProjectOpen}
              />
            )}

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

      {createOpen && (
        <ProjectFormDialog
          open
          title={MESSAGES.project.action.createFirst}
          submitLabel={MESSAGES.common.action.create}
          onOpenChange={handleCreateOpenChange}
          onSubmit={handleCreate}
          loading={createProject.isPending}
          error={
            createProject.error
              ? MESSAGES.project.error.createFailed
              : undefined
          }
        />
      )}

      {editingProject && (
        <ProjectFormDialog
          open
          title={MESSAGES.project.heading.editDialog}
          submitLabel={MESSAGES.common.action.save}
          initialName={editingProject.name}
          initialDescription={editingProject.description}
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
        open={Boolean(deletingProject)}
        projectName={deletingProject?.name ?? ''}
        onOpenChange={handleDeleteOpenChange}
        onConfirm={() => void handleDelete()}
        loading={deleteProject.isPending}
        error={
          deleteProject.error ? MESSAGES.project.error.deleteFailed : undefined
        }
      />
    </section>
  )
}

export { ProjectListContent }
