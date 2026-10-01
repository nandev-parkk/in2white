import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { SystemPage } from '@/pages/system'
import { AdminAppShell } from '@/widgets/app-shell'

export const Route = createFileRoute('/system')({
  beforeLoad: redirectIfUnauthenticated,
  component: SystemRoute,
})

function SystemRoute() {
  return (
    <AdminAppShell>
      <SystemPage />
    </AdminAppShell>
  )
}
