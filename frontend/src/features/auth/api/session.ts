import { axiosInstance } from '@/shared/api'

export interface RefreshAccessTokenResponse {
  accessToken: string
}

export async function refreshAccessTokenRequest(): Promise<RefreshAccessTokenResponse> {
  const { data } =
    await axiosInstance.post<RefreshAccessTokenResponse>('/auth/refresh')

  return data
}

export async function logoutRequest(): Promise<void> {
  await axiosInstance.post('/auth/logout')
}
