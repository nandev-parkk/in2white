import { axiosInstance } from '@/shared/api'

import type { AdminSessionAdmin } from '@/entities/admin-session'

export interface AdminLoginResponse {
  accessToken: string
  admin: AdminSessionAdmin
}

export async function adminLoginRequest(
  email: string,
  password: string,
): Promise<AdminLoginResponse> {
  const { data } = await axiosInstance.post<AdminLoginResponse>('/auth/login', {
    email,
    password,
  })

  return data
}
