import { create } from 'zustand'

export interface SessionUser {
  id: string
  name: string
  email: string
}

interface SessionState {
  accessToken: string | null
  user: SessionUser | null
  setSession: (accessToken: string, user: SessionUser) => void
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

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  updateAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ accessToken: null, user: null }),
}))
