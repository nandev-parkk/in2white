import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { UsersPage } from '@/pages/users'
import { AdminAppShell } from '@/widgets/app-shell'

export const Route = createFileRoute('/users')({
  beforeLoad: redirectIfUnauthenticated,
  component: UsersRoute,
})

function UsersRoute() {
  return (
    <AdminAppShell>
      <UsersPage />
    </AdminAppShell>
  )
}
