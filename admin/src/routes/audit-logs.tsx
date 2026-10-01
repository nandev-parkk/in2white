import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { AuditLogsPage } from '@/pages/audit-logs'
import { AdminAppShell } from '@/widgets/app-shell'

export const Route = createFileRoute('/audit-logs')({
  beforeLoad: redirectIfUnauthenticated,
  component: AuditLogsRoute,
})

function AuditLogsRoute() {
  return (
    <AdminAppShell>
      <AuditLogsPage />
    </AdminAppShell>
  )
}
