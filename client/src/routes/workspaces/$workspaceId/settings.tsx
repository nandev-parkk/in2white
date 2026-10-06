import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { WorkspaceSettingsPage } from '@/pages/workspace-settings'

import { redirectIfUnauthenticated } from '../../index'
import {
  PROJECTS_ROUTE,
  SETTINGS_ROUTE,
  WORKSPACE_NAV_ROUTES,
} from './-route-paths'

export { SETTINGS_ROUTE }

export const Route = createFileRoute('/workspaces/$workspaceId/settings')({
  beforeLoad: redirectIfUnauthenticated,
  component: WorkspaceSettingsRoute,
})

function WorkspaceSettingsRoute() {
  const { workspaceId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <WorkspaceSettingsPage
      workspaceId={workspaceId}
      onWorkspaceChange={(nextWorkspaceId) =>
        navigate({
          to: SETTINGS_ROUTE,
          params: { workspaceId: nextWorkspaceId },
        })
      }
      onNavChange={(key, selectedWorkspaceId) => {
        if (!selectedWorkspaceId) return

        void navigate({
          to: WORKSPACE_NAV_ROUTES[key],
          params: { workspaceId: selectedWorkspaceId },
        })
      }}
      onUserClick={(selectedWorkspaceId) => {
        void navigate({
          to: '/account',
          search: {
            workspaceId: selectedWorkspaceId ?? workspaceId,
          },
        })
      }}
      onDeleted={() => void navigate({ to: '/' })}
      onReturn={() =>
        void navigate({ to: PROJECTS_ROUTE, params: { workspaceId } })
      }
    />
  )
}
