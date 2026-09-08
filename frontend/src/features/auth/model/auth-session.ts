import { useSessionStore } from '@/entities/session'

import { refreshAccessTokenRequest } from '../api/session'

let refreshPromise: Promise<string> | null = null

export function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = refreshAccessTokenRequest()
    .then(({ accessToken }) => {
      useSessionStore.getState().updateAccessToken(accessToken)
      return accessToken
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}
