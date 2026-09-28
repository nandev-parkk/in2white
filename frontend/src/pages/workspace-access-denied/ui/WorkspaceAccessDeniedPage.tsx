import { Users } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { MESSAGES } from '@/shared/constants/messages'

type WorkspaceAccessDeniedPageProps = {
  workspaceName: string
  onReturn: () => void
}

export function WorkspaceAccessDeniedPage({
  workspaceName,
  onReturn,
}: WorkspaceAccessDeniedPageProps) {
  return (
    <main className="bg-background-default flex min-h-svh items-center justify-center">
      <div className="flex w-full max-w-90 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div
          className="flex size-10 items-center justify-center"
          aria-hidden="true"
        >
          <Users className="text-foreground-secondary size-6" />
        </div>
        <h1 className="text-heading1 text-foreground-strong">
          {MESSAGES.workspace.error.notFound}
        </h1>
        <p className="text-body text-foreground-secondary">
          {MESSAGES.workspace.error.notFoundDescription}
        </p>
        <Button variant="secondary" onClick={onReturn}>
          {MESSAGES.workspace.action.backTo(workspaceName)}
        </Button>
      </div>
    </main>
  )
}
