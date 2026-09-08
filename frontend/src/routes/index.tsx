import { createFileRoute } from '@tanstack/react-router'

import { HomePage } from '@/pages/home'
import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'

export { redirectIfUnauthenticated }

export const Route = createFileRoute('/')({
  beforeLoad: redirectIfUnauthenticated,
  component: HomePage,
})
