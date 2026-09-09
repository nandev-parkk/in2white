import { Users } from 'lucide-react'

import { Button } from '@/shared/ui/button'

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
          존재하지 않는 워크스페이스예요
        </h1>
        <p className="text-body text-foreground-secondary">
          입력한 워크스페이스를 찾을 수 없어요
        </p>
        <Button variant="secondary" onClick={onReturn}>
          {workspaceName}로 돌아가기
        </Button>
      </div>
    </main>
  )
}
