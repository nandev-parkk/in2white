import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { WhiteboardEditorPage } from '@/pages/whiteboard-editor'
import { redirectIfUnauthenticated } from '../../index'

export const Route = createFileRoute(
  '/workspaces/$workspaceId/projects_/$projectId_/whiteboard-documents/$documentId',
)({
  beforeLoad: redirectIfUnauthenticated,
  component: WhiteboardRoute,
})
function WhiteboardRoute() {
  const params = Route.useParams()
  const navigate = useNavigate()
  return (
    <WhiteboardEditorPage
      {...params}
      onBack={() =>
        void navigate({
          to: '/workspaces/$workspaceId/projects/$projectId',
          params: {
            workspaceId: params.workspaceId,
            projectId: params.projectId,
          },
        })
      }
    />
  )
}
