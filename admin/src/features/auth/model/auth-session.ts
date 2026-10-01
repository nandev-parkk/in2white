import { useAdminSessionStore } from '@/entities/admin-session'

import { refreshAdminAccessTokenRequest } from '../api/session'

let refreshPromise: Promise<string> | null = null

/* 동시에 여러 요청이 만료를 발견해도 refresh는 한 번만 보낸다 — 회전된 토큰이 서로를 폐기한다. */
export function refreshAdminAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = refreshAdminAccessTokenRequest()
    .then(({ accessToken, admin }) => {
      useAdminSessionStore.getState().setSession(accessToken, admin)
      return accessToken
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}
