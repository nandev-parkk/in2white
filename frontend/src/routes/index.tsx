import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'

import { useSessionStore } from '@/entities/session'
import { WorkspaceRedirectPage } from '@/pages/workspace-redirect'

export function redirectIfUnauthenticated() {
  const { accessToken, user } = useSessionStore.getState()

  if (!accessToken || !user) {
    throw redirect({ to: '/login' })
  }
}

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
