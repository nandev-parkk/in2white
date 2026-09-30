import { redirect } from '@tanstack/react-router'

import {
  isAccessTokenExpired,
  useAdminSessionStore,
} from '@/entities/admin-session'

import { refreshAdminAccessToken } from './auth-session'

interface RouteGuardContext {
  location?: {
    pathname: string
  }
}

export async function redirectIfUnauthenticated({
  location,
}: RouteGuardContext = {}) {
  const pathname = location?.pathname
  let { accessToken, admin } = useAdminSessionStore.getState()

  if (!accessToken || !admin || isAccessTokenExpired(accessToken)) {
    try {
      accessToken = await refreshAdminAccessToken()
      admin = useAdminSessionStore.getState().admin
    } catch {
      useAdminSessionStore.getState().clearSession()

      if (pathname === '/login') return
      throw redirect({ to: '/login' })
    }
  }

  if (pathname === '/login' && accessToken && admin) {
    throw redirect({ to: '/' })
  }
}
