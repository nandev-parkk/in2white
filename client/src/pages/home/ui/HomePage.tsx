import { MemberListContent } from '@/features/member/ui/MemberListContent'
import { ProjectListContent } from '@/features/project/ui/ProjectListContent'
import { AuthenticatedWorkspaceLayout } from '@/pages/shared/ui/AuthenticatedWorkspaceLayout'
import type { SidebarNavKey } from '@/widgets/sidebar'
import { MESSAGES } from '@/shared/constants/messages'

export function HomePage({
  workspaceId,
  activeNav = 'projects',
  onNavChange,
  onUserClick,
  onWorkspaceChange,
  onProjectOpen,
}: {
  workspaceId?: string
  activeNav?: 'projects' | 'members'
  onNavChange?: (key: SidebarNavKey, selectedWorkspaceId: string | null) => void
  onUserClick?: (selectedWorkspaceId: string | null) => void
  onWorkspaceChange?: (workspaceId: string) => void
  onProjectOpen?: (projectId: string) => void
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
        loadingStartedAt,
      }) =>
        workspaceId || selectedWorkspaceId ? (
          activeNav === 'members' ? (
            <MemberListContent
              loadingStartedAt={loadingStartedAt}
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
              key={`${user.id}:${workspaceId ?? selectedWorkspaceId}`}
              loadingStartedAt={loadingStartedAt}
              accessToken={accessToken}
              workspaceId={workspaceId ?? selectedWorkspaceId!}
              userId={user.id}
              workspaceRole={selectedWorkspace?.role}
              onProjectOpen={onProjectOpen}
            />
          )
        ) : (
          <p className="text-body text-foreground-secondary">
            {MESSAGES.workspace.empty.none}
          </p>
        )
      }
    </AuthenticatedWorkspaceLayout>
  )
}
