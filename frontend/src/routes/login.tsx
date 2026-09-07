import { createFileRoute, redirect } from '@tanstack/react-router'

import { useSessionStore } from '@/entities/session'
import { LoginPage } from '@/pages/login'

export function redirectIfAuthenticated() {
  if (useSessionStore.getState().accessToken) {
    throw redirect({ to: '/' })
  }
}

export const Route = createFileRoute('/login')({
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
})
