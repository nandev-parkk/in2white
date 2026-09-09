import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { useSessionStore } from '@/entities/session'
import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { WorkspaceRedirectPage } from '@/pages/workspace-redirect'

export { redirectIfUnauthenticated }

export const Route = createFileRoute('/')({
  beforeLoad: redirectIfUnauthenticated,
  component: RootRedirectRoute,
})

function RootRedirectRoute() {
  const accessToken = useSessionStore((state) => state.accessToken)
  const user = useSessionStore((state) => state.user)
  const navigate = useNavigate()

  if (!accessToken || !user) return null

  return (
    <WorkspaceRedirectPage
      accessToken={accessToken}
      user={user}
      onNavigate={(workspaceId) =>
        navigate({
          to: '/workspaces/$workspaceId/projects',
          params: { workspaceId },
          replace: true,
        })
      }
    />
  )
}
