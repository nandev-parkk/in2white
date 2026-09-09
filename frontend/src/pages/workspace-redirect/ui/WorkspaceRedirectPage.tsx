import { useEffect } from 'react'

import { selectDefaultWorkspace } from '@/entities/workspace'
import type { SessionUser } from '@/entities/session'
import { useWorkspaces } from '@/features/workspace'
import { Button } from '@/shared/ui/button'

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
        <p className="text-body text-foreground-secondary">
          워크스페이스로 이동하는 중
        </p>
      </main>
    )
  }

  if (isError) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <p className="text-body text-foreground-secondary">
          워크스페이스로 이동하지 못했어요
        </p>
        <Button variant="secondary" onClick={() => void refetch()}>
          다시 시도
        </Button>
      </main>
    )
  }

  if (!data?.length) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <p className="text-body text-foreground-secondary">
          이동할 워크스페이스가 없어요
        </p>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center">
      <p className="text-body text-foreground-secondary">
        프로젝트로 이동하는 중
      </p>
    </main>
  )
}
