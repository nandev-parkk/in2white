import { useEffect } from 'react'

import { selectDefaultWorkspace } from '@/entities/workspace'
import type { SessionUser } from '@/entities/session'
import { useWorkspaces } from '@/features/workspace'
import { Button } from '@/shared/ui/button'
import { LoadingState } from '@/shared/ui/loading-state'
import { MESSAGES } from '@/shared/constants/messages'

type WorkspaceRedirectPageProps = {
  accessToken: string
  user: SessionUser
  onNavigate: (workspaceId: string) => void
}

export function WorkspaceRedirectPage({
  accessToken,
  user,
  onNavigate,
}: WorkspaceRedirectPageProps) {
  const { data, isError, isLoading, refetch } = useWorkspaces(
    accessToken,
    user.id,
  )

  useEffect(() => {
    if (isLoading || isError) return

    const workspace = selectDefaultWorkspace(data ?? [])

    if (workspace) onNavigate(workspace.id)
  }, [data, isError, isLoading, onNavigate])

  if (isLoading) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <LoadingState label={MESSAGES.workspace.a11y.redirecting} />
      </main>
    )
  }

  if (isError) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <p className="text-body text-foreground-secondary">
          {MESSAGES.workspace.error.redirectFailed}
        </p>
        <Button variant="secondary" onClick={() => void refetch()}>
          {MESSAGES.common.action.retry}
        </Button>
      </main>
    )
  }

  if (!data?.length) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <p className="text-body text-foreground-secondary">
          {MESSAGES.workspace.error.notAvailable}
        </p>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center">
      <LoadingState label={MESSAGES.workspace.a11y.redirectingToProject} />
    </main>
  )
}
