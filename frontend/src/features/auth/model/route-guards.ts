import { redirect } from '@tanstack/react-router'

import { isAccessTokenExpired, useSessionStore } from '@/entities/session'

import { refreshAccessToken } from './auth-session'

interface RouteGuardContext {
  location?: {
    pathname: string
  }
}

export async function redirectIfUnauthenticated({
  location,
}: RouteGuardContext = {}) {
  if (location?.pathname === '/login') return

  const { accessToken, user } = useSessionStore.getState()

  if (!accessToken || !user) {
    throw redirect({ to: '/login' })
  }

  if (isAccessTokenExpired(accessToken)) {
    try {
      await refreshAccessToken()
    } catch {
      useSessionStore.getState().clearSession()
      throw redirect({ to: '/login' })
    }
  }
}

export async function redirectIfAuthenticated() {
  const { accessToken, user } = useSessionStore.getState()

  if (accessToken && user && isAccessTokenExpired(accessToken)) {
    try {
      await refreshAccessToken()
    } catch {
      useSessionStore.getState().clearSession()
      return
    }
  }

  if (useSessionStore.getState().accessToken && user) {
    throw redirect({ to: '/' })
  }
}
