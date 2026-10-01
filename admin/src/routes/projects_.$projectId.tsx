import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { ProjectDetailPage } from '@/pages/project-detail'
import { AdminAppShell } from '@/widgets/app-shell'

/* 워크스페이스 상세와 같다 — 목록을 부모로 삼지 않는 독립 화면이다. */
export const Route = createFileRoute('/projects_/$projectId')({
  beforeLoad: redirectIfUnauthenticated,
  component: ProjectDetailRoute,
})

function ProjectDetailRoute() {
  const { projectId } = Route.useParams()

  return (
    <AdminAppShell>
      <ProjectDetailPage projectId={projectId} />
    </AdminAppShell>
  )
}
