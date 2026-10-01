import { createFileRoute } from '@tanstack/react-router'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'
import { WhiteboardDocumentsPage } from '@/pages/whiteboard-documents'
import { AdminAppShell } from '@/widgets/app-shell'

export const Route = createFileRoute('/whiteboard-documents')({
  beforeLoad: redirectIfUnauthenticated,
  component: WhiteboardDocumentsRoute,
})

function WhiteboardDocumentsRoute() {
  return (
    <AdminAppShell>
      <WhiteboardDocumentsPage />
    </AdminAppShell>
  )
}
