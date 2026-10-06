import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { ProjectDetailPage } from '@/pages/project-detail'

import { redirectIfUnauthenticated } from '../../index'
import { PROJECT_DETAIL_ROUTE, PROJECTS_ROUTE } from './-route-paths'

export { PROJECT_DETAIL_ROUTE }

export const Route = createFileRoute(
  '/workspaces/$workspaceId/projects_/$projectId',
)({
  beforeLoad: redirectIfUnauthenticated,
  component: WorkspaceProjectDetailRoute,
})

function WorkspaceProjectDetailRoute() {
  const { workspaceId, projectId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <ProjectDetailPage
      workspaceId={workspaceId}
      projectId={projectId}
      onDocumentOpen={(documentId) =>
        void navigate({
          to: '/workspaces/$workspaceId/projects/$projectId/whiteboard-documents/$documentId',
          params: { workspaceId, projectId, documentId },
        })
      }
      onBack={() =>
        void navigate({ to: PROJECTS_ROUTE, params: { workspaceId } })
      }
      onWorkspaceChange={(nextWorkspaceId) =>
        void navigate({
          to: PROJECTS_ROUTE,
          params: { workspaceId: nextWorkspaceId },
        })
      }
      onUserClick={(selectedWorkspaceId) => {
        void navigate({
          to: '/account',
          search: { workspaceId: selectedWorkspaceId ?? workspaceId },
        })
      }}
    />
  )
}
