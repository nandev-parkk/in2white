import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'

import { useSessionStore, type SessionUser } from '@/entities/session'
import {
  selectDefaultWorkspace,
  type WorkspaceSummary,
} from '@/entities/workspace'
import { logoutRequest } from '@/features/auth'
import { useCreateWorkspace, useWorkspaces } from '@/features/workspace'
import { WorkspaceCreateDialog } from '@/features/workspace/ui/WorkspaceCreateDialog'
import { WorkspaceAccessDeniedPage } from '@/pages/workspace-access-denied'
import { Button } from '@/shared/ui/button'
import { Sidebar, type SidebarNavKey } from '@/shared/ui/sidebar'
import { toast } from '@/shared/ui/toast'

const COMPACT_SIDEBAR_MEDIA_QUERY = '(max-width: 639px)'

export type WorkspaceShellContext = {
  accessToken: string
  user: SessionUser
  workspaces: WorkspaceSummary[]
  selectedWorkspace: WorkspaceSummary | null
  selectedWorkspaceId: string | null
  workspaceLoading: boolean
  workspaceError: boolean
  refetchWorkspaces: () => Promise<unknown>
}

export type AuthenticatedWorkspaceLayoutProps = {
  workspaceId?: string
  activeNav?: SidebarNavKey
  unknownWorkspace?: 'deny' | 'fallback'
  workspaceMode?: 'required' | 'optional'
  onWorkspaceChange?: (workspaceId: string) => void
  onNavChange?: (key: SidebarNavKey, selectedWorkspaceId: string | null) => void
  onUserClick?: (selectedWorkspaceId: string | null) => void
  children: (context: WorkspaceShellContext) => ReactNode
}

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

function WorkspaceLayoutContent({
  accessToken,
  user,
  onLogout,
  workspaceId,
  activeNav,
  unknownWorkspace = 'deny',
  workspaceMode = 'required',
  onWorkspaceChange,
  onNavChange,
  onUserClick,
  children,
}: AuthenticatedWorkspaceLayoutProps & {
  accessToken: string
  user: SessionUser
  onLogout: () => Promise<void>
}) {
  const { data, isLoading, isError, refetch } = useWorkspaces(
    accessToken,
    user.id,
  )
  const createWorkspace = useCreateWorkspace(accessToken)
  const compactSidebar = useCompactSidebar()
  const [collapsed, setCollapsed] = useState(false)
  const isSidebarCollapsed = compactSidebar || collapsed
  const [internalActiveNav, setInternalActiveNav] = useState<SidebarNavKey>(
    activeNav ?? 'projects',
  )
  const resolvedActiveNav = activeNav ?? internalActiveNav
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    workspaceId ?? null,
  )
  const [createdWorkspaceOverlay, setCreatedWorkspaceOverlay] = useState<{
    workspace: WorkspaceSummary
    sourceData: WorkspaceSummary[] | undefined
  } | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const isWorkspaceOptional = workspaceMode === 'optional'

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
    ? (routeWorkspace ??
      (unknownWorkspace === 'fallback' ? fallbackWorkspace : null))
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

  if (isError && !isWorkspaceOptional) {
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

  if (
    !isLoading &&
    workspaceId &&
    !routeWorkspace &&
    unknownWorkspace === 'deny'
  ) {
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

  function handleNavChange(key: SidebarNavKey) {
    setInternalActiveNav(key)
    onNavChange?.(key, resolvedSelectedWorkspaceId)
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
        activeNav={resolvedActiveNav}
        onNavChange={handleNavChange}
        onUserClick={() => onUserClick?.(resolvedSelectedWorkspaceId)}
        onLogout={() => void onLogout()}
        userName={user.name}
        userEmail={user.email}
      />

      <main className="flex min-w-0 flex-1 flex-col px-5 pt-6 pb-12">
        {!isWorkspaceOptional && isLoading ? (
          <p className="text-body text-foreground-secondary">
            워크스페이스 불러오는 중
          </p>
        ) : (
          children({
            accessToken,
            user,
            workspaces,
            selectedWorkspace,
            selectedWorkspaceId: resolvedSelectedWorkspaceId,
            workspaceLoading: isLoading,
            workspaceError: isError,
            refetchWorkspaces: () => refetch(),
          })
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

export function AuthenticatedWorkspaceLayout({
  workspaceId,
  activeNav,
  unknownWorkspace,
  workspaceMode,
  onWorkspaceChange,
  onNavChange,
  onUserClick,
  children,
}: AuthenticatedWorkspaceLayoutProps) {
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

  if (!accessToken || !user) return null

  return (
    <WorkspaceLayoutContent
      accessToken={accessToken}
      user={user}
      onLogout={handleLogout}
      workspaceId={workspaceId}
      activeNav={activeNav}
      unknownWorkspace={unknownWorkspace}
      workspaceMode={workspaceMode}
      onWorkspaceChange={onWorkspaceChange}
      onNavChange={onNavChange}
      onUserClick={onUserClick}
    >
      {children}
    </WorkspaceLayoutContent>
  )
}
