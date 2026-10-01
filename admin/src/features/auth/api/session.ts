import { axiosInstance } from '@/shared/api'

import type { AdminSessionAdmin } from '@/entities/admin-session'

export interface RefreshAdminAccessTokenResponse {
  accessToken: string
  admin: AdminSessionAdmin
}

export async function refreshAdminAccessTokenRequest(): Promise<RefreshAdminAccessTokenResponse> {
  const { data } =
    await axiosInstance.post<RefreshAdminAccessTokenResponse>('/auth/refresh')

  return data
}

export async function adminLogoutRequest(): Promise<void> {
  await axiosInstance.post('/auth/logout')
}
