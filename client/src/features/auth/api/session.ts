import { axiosInstance } from '@/shared/api'

import type { SessionUser } from '@/entities/session'

export interface RefreshAccessTokenResponse {
  accessToken: string
  user: SessionUser
}

export async function refreshAccessTokenRequest(): Promise<RefreshAccessTokenResponse> {
  const { data } =
    await axiosInstance.post<RefreshAccessTokenResponse>('/auth/refresh')

  return data
}

export async function logoutRequest(): Promise<void> {
  await axiosInstance.post('/auth/logout')
}
