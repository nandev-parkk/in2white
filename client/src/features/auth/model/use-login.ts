import { useMutation } from '@tanstack/react-query'

import { useSessionStore } from '@/entities/session'

import { loginRequest } from '../api/login'

export interface LoginCredentials {
  email: string
  password: string
}

export function useLogin() {
  return useMutation({
    mutationFn: ({ email, password }: LoginCredentials) =>
      loginRequest(email, password),
    onSuccess: (data) => {
      useSessionStore.getState().setSession(data.accessToken, data.user)
    },
  })
}
