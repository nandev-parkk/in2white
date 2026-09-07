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
  clearSession: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
}))
