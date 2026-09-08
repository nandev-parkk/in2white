import { createFileRoute } from '@tanstack/react-router'

import { LoginPage } from '@/pages/login'
import { redirectIfAuthenticated } from '@/features/auth/model/route-guards'

export { redirectIfAuthenticated }

export const Route = createFileRoute('/login')({
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
})
