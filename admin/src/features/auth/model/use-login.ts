import { useMutation } from '@tanstack/react-query'

import { useAdminSessionStore } from '@/entities/admin-session'

import { adminLoginRequest } from '../api/login'

export interface AdminLoginCredentials {
  email: string
  password: string
}

export function useAdminLogin() {
  return useMutation({
    mutationFn: ({ email, password }: AdminLoginCredentials) =>
      adminLoginRequest(email, password),
    onSuccess: (data) => {
      useAdminSessionStore.getState().setSession(data.accessToken, data.admin)
    },
  })
}
