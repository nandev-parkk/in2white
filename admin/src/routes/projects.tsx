import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { ProjectsPage } from '@/pages/projects'
import { AdminAppShell } from '@/widgets/app-shell'

export const Route = createFileRoute('/projects')({
  beforeLoad: redirectIfUnauthenticated,
  component: ProjectsRoute,
})

function ProjectsRoute() {
  return (
    <AdminAppShell>
      <ProjectsPage />
    </AdminAppShell>
  )
}
