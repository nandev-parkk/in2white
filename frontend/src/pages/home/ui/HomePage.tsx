import { useMemo, useState } from 'react'

import { useSessionStore } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'
import { useCreateWorkspace, useWorkspaces } from '@/features/workspace'
import { WorkspaceCreateDialog } from '@/features/workspace/ui/WorkspaceCreateDialog'
import { Button } from '@/shared/ui/button'
import { Sidebar, type SidebarNavKey } from '@/shared/ui/sidebar'

type SessionUser = NonNullable<
  ReturnType<typeof useSessionStore.getState>['user']
>

function AuthenticatedHomePage({
  accessToken,
  user,
  onLogout,
}: {
  accessToken: string
  user: SessionUser
  onLogout: () => void
}) {
  const { data, isLoading, isError, refetch } = useWorkspaces(
    accessToken,
    user.id,
  )
  const createWorkspace = useCreateWorkspace(accessToken)
  const [collapsed, setCollapsed] = useState(false)
  const [activeNav, setActiveNav] = useState<SidebarNavKey>('projects')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  )
  const [createdWorkspaceOverlay, setCreatedWorkspaceOverlay] = useState<{
    workspace: WorkspaceSummary
    sourceData: WorkspaceSummary[] | undefined
  } | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  const workspaces = useMemo(() => {
    const fetchedWorkspaces = data ?? []
    const createdWorkspace =
      createdWorkspaceOverlay && createdWorkspaceOverlay.sourceData === data
        ? createdWorkspaceOverlay.workspace
        : null
    return createdWorkspace &&
      !fetchedWorkspaces.some(({ id }) => id === createdWorkspace.id)
      ? [...fetchedWorkspaces, createdWorkspace]
      : fetchedWorkspaces
  }, [createdWorkspaceOverlay, data])
  const [previousWorkspaces, setPreviousWorkspaces] = useState(workspaces)
  const fallbackWorkspace =
    workspaces.find(({ isDefault }) => isDefault) ?? workspaces[0] ?? null
  const fallbackWorkspaceId = fallbackWorkspace?.id ?? null
  const selectedWorkspace =
    workspaces.find(({ id }) => id === selectedWorkspaceId) ?? fallbackWorkspace
  const resolvedSelectedWorkspaceId = selectedWorkspace?.id ?? null

  if (previousWorkspaces !== workspaces) {
    setPreviousWorkspaces(workspaces)
    setSelectedWorkspaceId((currentWorkspaceId) =>
      currentWorkspaceId &&
      workspaces.some(({ id }) => id === currentWorkspaceId)
        ? currentWorkspaceId
        : fallbackWorkspaceId,
    )
  }

  if (isError) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <p className="text-body text-foreground-secondary">
          워크스페이스를 불러오지 못했어요
        </p>
        <Button variant="secondary" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </main>
    )
  }

  function handleCreateDialogOpenChange(open: boolean) {
    if (!open && createWorkspace.isPending) return
    if (!open) createWorkspace.reset()
    setCreateDialogOpen(open)
  }

  async function handleCreateWorkspace(name: string) {
    try {
      const workspace = await createWorkspace.mutateAsync(name)
      setCreatedWorkspaceOverlay({ workspace, sourceData: data })
      setSelectedWorkspaceId(workspace.id)
      handleCreateDialogOpenChange(false)
    } catch {
      return
    }
  }

  return (
    <div className="bg-background-canvas flex min-h-svh">
      <Sidebar
        className="min-h-svh shrink-0"
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        workspaceLoading={isLoading}
        workspace={selectedWorkspace}
        workspaces={workspaces}
        selectedWorkspaceId={resolvedSelectedWorkspaceId}
        onWorkspaceChange={setSelectedWorkspaceId}
        onCreateWorkspace={() => handleCreateDialogOpenChange(true)}
        workspaceMembers={[{ id: user.id, name: user.name, presenceIndex: 1 }]}
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onLogout={onLogout}
        userName={user.name}
        userEmail={user.email}
      />

      <main className="flex min-w-0 flex-1 flex-col gap-2 p-8">
        {isLoading ? (
          <p className="text-body text-foreground-secondary">
            워크스페이스 불러오는 중
          </p>
        ) : (
          <>
            <h1 className="text-heading1 text-foreground-strong">프로젝트</h1>
            <p className="text-body text-foreground-secondary">
              {selectedWorkspace?.name ?? '워크스페이스 없음'}
            </p>
          </>
        )}
      </main>

      <WorkspaceCreateDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        onSubmit={handleCreateWorkspace}
        loading={createWorkspace.isPending}
        error={
          createWorkspace.error ? '워크스페이스를 만들지 못했어요' : undefined
        }
      />
    </div>
  )
}

export function HomePage() {
  const accessToken = useSessionStore((state) => state.accessToken)
  const user = useSessionStore((state) => state.user)
  const clearSession = useSessionStore((state) => state.clearSession)

  if (!accessToken || !user) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <p className="text-body text-foreground-secondary">로그인이 필요해요</p>
      </main>
    )
  }

  return (
    <AuthenticatedHomePage
      accessToken={accessToken}
      user={user}
      onLogout={clearSession}
    />
  )
}
