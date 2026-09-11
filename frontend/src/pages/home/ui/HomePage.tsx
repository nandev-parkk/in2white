import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { useSessionStore, type SessionUser } from '@/entities/session'
import {
  selectDefaultWorkspace,
  type WorkspaceSummary,
} from '@/entities/workspace'
import { logoutRequest } from '@/features/auth'
import { useCreateWorkspace, useWorkspaces } from '@/features/workspace'
import { ProjectListContent } from '@/features/project/ui/ProjectListContent'
import { WorkspaceCreateDialog } from '@/features/workspace/ui/WorkspaceCreateDialog'
import { WorkspaceAccessDeniedPage } from '@/pages/workspace-access-denied'
import { Button } from '@/shared/ui/button'
import { Sidebar, type SidebarNavKey } from '@/shared/ui/sidebar'
import { toast } from '@/shared/ui/toast'

const COMPACT_SIDEBAR_MEDIA_QUERY = '(max-width: 639px)'

function useCompactSidebar() {
  const getMediaQuery = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return null
    return window.matchMedia(COMPACT_SIDEBAR_MEDIA_QUERY)
  }
  const [isCompact, setIsCompact] = useState(
    () => getMediaQuery()?.matches ?? false,
  )

  useEffect(() => {
    const mediaQuery = getMediaQuery()
    if (!mediaQuery) return

    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompact(event.matches)
    }
    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return isCompact
}

function AuthenticatedHomePage({
  accessToken,
  user,
  onLogout,
  workspaceId,
  onWorkspaceChange,
}: {
  accessToken: string
  user: SessionUser
  onLogout: () => void
  workspaceId?: string
  onWorkspaceChange?: (workspaceId: string) => void
}) {
  const { data, isLoading, isError, refetch } = useWorkspaces(
    accessToken,
    user.id,
  )
  const createWorkspace = useCreateWorkspace(accessToken)
  const compactSidebar = useCompactSidebar()
  const [collapsed, setCollapsed] = useState(false)
  const isSidebarCollapsed = compactSidebar || collapsed
  const [activeNav, setActiveNav] = useState<SidebarNavKey>('projects')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    workspaceId ?? null,
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
  const fallbackWorkspace = selectDefaultWorkspace(workspaces)
  const fallbackWorkspaceId = fallbackWorkspace?.id ?? null
  const routeWorkspace = workspaceId
    ? (workspaces.find(({ id }) => id === workspaceId) ?? null)
    : null
  const selectedWorkspace = workspaceId
    ? routeWorkspace
    : (workspaces.find(({ id }) => id === selectedWorkspaceId) ??
      fallbackWorkspace)
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

  if (!isLoading && workspaceId && !routeWorkspace) {
    return (
      <WorkspaceAccessDeniedPage
        workspaceName={fallbackWorkspace?.name ?? '기본 워크스페이스'}
        onReturn={() => {
          if (fallbackWorkspaceId) onWorkspaceChange?.(fallbackWorkspaceId)
        }}
      />
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
      toast.success('워크스페이스를 만들었어요')
      handleCreateDialogOpenChange(false)
    } catch {
      return
    }
  }

  function handleWorkspaceChange(nextWorkspaceId: string) {
    setSelectedWorkspaceId(nextWorkspaceId)
    onWorkspaceChange?.(nextWorkspaceId)
  }

  return (
    <div className="bg-background-default flex min-h-svh">
      <Sidebar
        className="min-h-svh shrink-0"
        collapsed={isSidebarCollapsed}
        onCollapsedChange={setCollapsed}
        workspaceLoading={isLoading}
        workspace={selectedWorkspace}
        workspaces={workspaces}
        selectedWorkspaceId={resolvedSelectedWorkspaceId}
        onWorkspaceChange={handleWorkspaceChange}
        onCreateWorkspace={() => handleCreateDialogOpenChange(true)}
        workspaceDialogOpen={createDialogOpen}
        workspaceMembers={[{ id: user.id, name: user.name, presenceIndex: 1 }]}
        activeNav={activeNav}
        onNavChange={setActiveNav}
        onLogout={onLogout}
        userName={user.name}
        userEmail={user.email}
      />

      <main className="flex min-w-0 flex-1 flex-col px-5 pt-6 pb-12">
        {isLoading ? (
          <p className="text-body text-foreground-secondary">
            워크스페이스 불러오는 중
          </p>
        ) : workspaceId || resolvedSelectedWorkspaceId ? (
          <ProjectListContent
            accessToken={accessToken}
            workspaceId={workspaceId ?? resolvedSelectedWorkspaceId!}
            userId={user.id}
            workspaceRole={selectedWorkspace?.role}
          />
        ) : (
          <p className="text-body text-foreground-secondary">
            워크스페이스 없음
          </p>
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

export function HomePage({
  workspaceId,
  onWorkspaceChange,
}: {
  workspaceId?: string
  onWorkspaceChange?: (workspaceId: string) => void
} = {}) {
  const navigate = useNavigate()
  const accessToken = useSessionStore((state) => state.accessToken)
  const user = useSessionStore((state) => state.user)
  const clearSession = useSessionStore((state) => state.clearSession)

  async function handleLogout() {
    try {
      await logoutRequest()
    } catch {
      // 클라이언트 세션 정리와 로그인 페이지 이동은 로그아웃 API 실패와 무관하게 보장한다.
    } finally {
      clearSession()
      await navigate({ to: '/login', replace: true })
    }
  }

  if (!accessToken || !user) {
    return null
  }

  return (
    <AuthenticatedHomePage
      accessToken={accessToken}
      user={user}
      onLogout={handleLogout}
      workspaceId={workspaceId}
      onWorkspaceChange={onWorkspaceChange}
    />
  )
}
