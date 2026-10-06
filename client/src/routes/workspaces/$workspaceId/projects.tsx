import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { HomePage } from '@/pages/home'

import { redirectIfUnauthenticated } from '../../index'
import {
  PROJECT_DETAIL_ROUTE,
  PROJECTS_ROUTE,
  WORKSPACE_NAV_ROUTES,
} from './-route-paths'

export { PROJECTS_ROUTE }

export const Route = createFileRoute('/workspaces/$workspaceId/projects')({
  beforeLoad: redirectIfUnauthenticated,
  component: WorkspaceProjectsRoute,
})

function WorkspaceProjectsRoute() {
  const { workspaceId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <HomePage
      workspaceId={workspaceId}
      onWorkspaceChange={(nextWorkspaceId) =>
        navigate({
          to: PROJECTS_ROUTE,
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
      onProjectOpen={(projectId) =>
        void navigate({
          to: PROJECT_DETAIL_ROUTE,
          params: { workspaceId, projectId },
        })
      }
    />
  )
}
