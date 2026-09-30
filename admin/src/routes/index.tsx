import { createFileRoute } from '@tanstack/react-router'

import { DashboardPage } from '@/pages/dashboard'
import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { AdminAppShell } from '@/widgets/app-shell'

export const Route = createFileRoute('/')({
  beforeLoad: redirectIfUnauthenticated,
  component: DashboardRoute,
})

function DashboardRoute() {
  return (
    <AdminAppShell>
      <DashboardPage />
    </AdminAppShell>
  )
}
