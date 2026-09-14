import { MemberListContent } from '@/features/member/ui/MemberListContent'
import { ProjectListContent } from '@/features/project/ui/ProjectListContent'
import { AuthenticatedWorkspaceLayout } from '@/pages/shared/ui/AuthenticatedWorkspaceLayout'
import type { SidebarNavKey } from '@/shared/ui/sidebar'

export function HomePage({
  workspaceId,
  activeNav = 'projects',
  onNavChange,
  onUserClick,
  onWorkspaceChange,
}: {
  workspaceId?: string
  activeNav?: 'projects' | 'members'
  onNavChange?: (key: SidebarNavKey, selectedWorkspaceId: string | null) => void
  onUserClick?: (selectedWorkspaceId: string | null) => void
  onWorkspaceChange?: (workspaceId: string) => void
} = {}) {
  return (
    <AuthenticatedWorkspaceLayout
      workspaceId={workspaceId}
      activeNav={activeNav}
      onNavChange={onNavChange}
      onUserClick={onUserClick}
      onWorkspaceChange={onWorkspaceChange}
    >
      {({
        accessToken,
        selectedWorkspace,
        selectedWorkspaceId,
        user,
        onAccessLost,
      }) =>
        workspaceId || selectedWorkspaceId ? (
          activeNav === 'members' ? (
            <MemberListContent
              key={`${user.id}:${workspaceId ?? selectedWorkspaceId}`}
              accessToken={accessToken}
              userId={user.id}
              workspaceId={workspaceId ?? selectedWorkspaceId!}
              workspaceRole={selectedWorkspace?.role}
              canAddMember={!selectedWorkspace?.isDefault}
              onAccessLost={onAccessLost}
            />
          ) : (
            <ProjectListContent
              accessToken={accessToken}
              workspaceId={workspaceId ?? selectedWorkspaceId!}
              userId={user.id}
              workspaceRole={selectedWorkspace?.role}
            />
          )
        ) : (
          <p className="text-body text-foreground-secondary">
            워크스페이스 없음
          </p>
        )
      }
    </AuthenticatedWorkspaceLayout>
  )
}
