import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { WorkspacesPage } from '@/pages/workspaces'
import { AdminAppShell } from '@/widgets/app-shell'

export const Route = createFileRoute('/workspaces')({
  beforeLoad: redirectIfUnauthenticated,
  component: WorkspacesRoute,
})

function WorkspacesRoute() {
  return (
    <AdminAppShell>
      <WorkspacesPage />
    </AdminAppShell>
  )
}
