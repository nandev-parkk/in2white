import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { WorkspaceDetailPage } from '@/pages/workspace-detail'
import { AdminAppShell } from '@/widgets/app-shell'

/* 사용자 상세와 같다 — 목록을 부모로 삼지 않는 독립 화면이다. */
export const Route = createFileRoute('/workspaces_/$workspaceId')({
  beforeLoad: redirectIfUnauthenticated,
  component: WorkspaceDetailRoute,
})

function WorkspaceDetailRoute() {
  const { workspaceId } = Route.useParams()

  return (
    <AdminAppShell>
      <WorkspaceDetailPage workspaceId={workspaceId} />
    </AdminAppShell>
  )
}
