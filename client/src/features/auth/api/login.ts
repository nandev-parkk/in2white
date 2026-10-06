import { axiosInstance } from '@/shared/api'

export interface LoginResponse {
  accessToken: string
  user: {
    id: string
    name: string
    email: string
  }
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await axiosInstance.post<LoginResponse>('/auth/login', {
    email,
    password,
  })

  return data
}
