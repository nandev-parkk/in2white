import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { HomePage } from '@/pages/home'

import { redirectIfUnauthenticated } from '../../index'
import { WORKSPACE_NAV_ROUTES } from './-route-paths'

export const Route = createFileRoute('/workspaces/$workspaceId/members')({
  beforeLoad: redirectIfUnauthenticated,
  component: WorkspaceMembersRoute,
})
function WorkspaceMembersRoute() {
  const { workspaceId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <HomePage
      workspaceId={workspaceId}
      activeNav="members"
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
          search: { workspaceId: selectedWorkspaceId ?? workspaceId },
        })
      }}
      onWorkspaceChange={(nextWorkspaceId) =>
        navigate({
          to: '/workspaces/$workspaceId/members',
          params: { workspaceId: nextWorkspaceId },
        })
      }
    />
  )
}
