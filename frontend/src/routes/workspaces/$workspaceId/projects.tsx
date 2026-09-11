import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { HomePage } from '@/pages/home'

import { redirectIfUnauthenticated } from '../../index'

export const PROJECTS_ROUTE = '/workspaces/$workspaceId/projects' as const

export const Route = createFileRoute('/workspaces/$workspaceId/projects')({
  beforeLoad: redirectIfUnauthenticated,
  component: WorkspaceProjectsRoute,
})

function WorkspaceProjectsRoute() {
  const { workspaceId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <HomePage
      key={workspaceId}
      workspaceId={workspaceId}
      onWorkspaceChange={(nextWorkspaceId) =>
        navigate({
          to: PROJECTS_ROUTE,
          params: { workspaceId: nextWorkspaceId },
        })
      }
      onUserClick={(selectedWorkspaceId) => {
        void navigate({
          to: '/account',
          search: {
            workspaceId: selectedWorkspaceId ?? workspaceId,
          },
        })
      }}
    />
  )
}
