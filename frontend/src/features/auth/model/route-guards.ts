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
  const pathname = location?.pathname
  let { accessToken, user } = useSessionStore.getState()

  if (!accessToken || !user || isAccessTokenExpired(accessToken)) {
    try {
      accessToken = await refreshAccessToken()
      user = useSessionStore.getState().user
    } catch {
      useSessionStore.getState().clearSession()

      if (pathname === '/login') return
      throw redirect({ to: '/login' })
    }
  }

  if (pathname === '/login' && accessToken && user) {
    throw redirect({ to: '/' })
  }
}
