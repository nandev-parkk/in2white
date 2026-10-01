import { create } from 'zustand'

export interface AdminSessionAdmin {
  id: string
  email: string
}

interface AdminSessionState {
  accessToken: string | null
  admin: AdminSessionAdmin | null
  setSession: (accessToken: string, admin: AdminSessionAdmin) => void
  updateAccessToken: (accessToken: string) => void
  clearSession: () => void
}

function decodePayload(token: string): unknown {
  const payload = token.split('.')[1]
  if (!payload) return null

  try {
    const normalized = payload.replaceAll('-', '+').replaceAll('_', '/')
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    )
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

export function isAccessTokenExpired(
  accessToken: string,
  nowInSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const payload = decodePayload(accessToken)

  return (
    typeof payload !== 'object' ||
    payload === null ||
    !('exp' in payload) ||
    typeof payload.exp !== 'number' ||
    payload.exp <= nowInSeconds
  )
}

/*
 * 토큰은 메모리에만 둔다. localStorage에 두면 XSS 한 번으로 서비스 전체 권한이 있는
 * 토큰이 유출된다. 새로고침 시에는 refresh 쿠키로 다시 세션을 복구한다.
 */
export const useAdminSessionStore = create<AdminSessionState>((set) => ({
  accessToken: null,
  admin: null,
  setSession: (accessToken, admin) => set({ accessToken, admin }),
  updateAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ accessToken: null, admin: null }),
}))
