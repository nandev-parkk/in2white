import { WorkspaceSettingsContent } from '@/features/workspace/ui/WorkspaceSettingsContent'
import { WorkspaceAccessDeniedPage } from '@/pages/workspace-access-denied/ui/WorkspaceAccessDeniedPage'
import { AuthenticatedWorkspaceLayout } from '@/pages/shared/ui/AuthenticatedWorkspaceLayout'

type WorkspaceSettingsPageProps = {
  workspaceId: string
  onWorkspaceChange: (workspaceId: string) => void
  onNavChange: (
    key: 'projects' | 'members' | 'settings',
    workspaceId: string | null,
  ) => void
  onUserClick: (workspaceId: string | null) => void
  onDeleted: () => void
  onReturn: () => void
}

export function WorkspaceSettingsPage({
  workspaceId,
  onWorkspaceChange,
  onNavChange,
  onUserClick,
  onDeleted,
  onReturn,
}: WorkspaceSettingsPageProps) {
  return (
    <AuthenticatedWorkspaceLayout
      workspaceId={workspaceId}
      activeNav="settings"
      workspaceMode="required"
      onWorkspaceChange={onWorkspaceChange}
      onNavChange={onNavChange}
      onUserClick={onUserClick}
    >
      {({ accessToken, selectedWorkspace }) =>
        selectedWorkspace?.role === 'owner' ? (
          <WorkspaceSettingsContent
            key={selectedWorkspace.id}
            workspace={selectedWorkspace}
            accessToken={accessToken}
            onDeleted={onDeleted}
          />
        ) : (
          <WorkspaceAccessDeniedPage
            workspaceName={selectedWorkspace?.name ?? ''}
            onReturn={onReturn}
          />
        )
      }
    </AuthenticatedWorkspaceLayout>
  )
}
