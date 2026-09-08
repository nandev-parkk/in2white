import { createFileRoute, redirect } from '@tanstack/react-router'

import { useSessionStore } from '@/entities/session'
import { HomePage } from '@/pages/home'

export function redirectIfUnauthenticated() {
  const { accessToken, user } = useSessionStore.getState()

  if (!accessToken || !user) {
    throw redirect({ to: '/login' })
  }
}

export const Route = createFileRoute('/')({
  beforeLoad: redirectIfUnauthenticated,
  component: HomePage,
})
