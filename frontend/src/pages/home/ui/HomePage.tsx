import { ProjectListContent } from '@/features/project/ui/ProjectListContent'
import { AuthenticatedWorkspaceLayout } from '@/pages/shared/ui/AuthenticatedWorkspaceLayout'
import type { SidebarNavKey } from '@/shared/ui/sidebar'

export function HomePage({
  workspaceId,
  onNavChange,
  onUserClick,
  onWorkspaceChange,
}: {
  workspaceId?: string
  onNavChange?: (key: SidebarNavKey, selectedWorkspaceId: string | null) => void
  onUserClick?: (selectedWorkspaceId: string | null) => void
  onWorkspaceChange?: (workspaceId: string) => void
} = {}) {
  return (
    <AuthenticatedWorkspaceLayout
      workspaceId={workspaceId}
      onNavChange={onNavChange}
      onUserClick={onUserClick}
      onWorkspaceChange={onWorkspaceChange}
    >
      {({ accessToken, selectedWorkspace, selectedWorkspaceId, user }) =>
        workspaceId || selectedWorkspaceId ? (
          <ProjectListContent
            accessToken={accessToken}
            workspaceId={workspaceId ?? selectedWorkspaceId!}
            userId={user.id}
            workspaceRole={selectedWorkspace?.role}
          />
        ) : (
          <p className="text-body text-foreground-secondary">
            워크스페이스 없음
          </p>
        )
      }
    </AuthenticatedWorkspaceLayout>
  )
}
