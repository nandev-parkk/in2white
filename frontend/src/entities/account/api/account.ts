import { axiosInstance } from '@/shared/api'
import type { SessionUser } from '@/entities/session'

export type AccountUser = SessionUser
export type UpdateAccountInput = { name: string }
export type ChangeAccountPasswordInput = {
  currentPassword: string
  newPassword: string
}
export type ChangeAccountPasswordResult = {
  accessToken: string
  user: AccountUser
}

type AccountResponse = { user: AccountUser }

export async function getAccountRequest(
  accessToken: string,
  signal?: AbortSignal,
): Promise<AccountUser> {
  const config = {
    headers: { Authorization: 'Bearer ' + accessToken },
    ...(signal ? { signal } : {}),
  }
  const { data } = await axiosInstance.get<AccountResponse>('/account', {
    ...config,
  })
  return data.user
}

export async function updateAccountRequest(
  input: UpdateAccountInput,
  accessToken: string,
): Promise<AccountUser> {
  const { data } = await axiosInstance.patch<AccountResponse>(
    '/account',
    input,
    { headers: { Authorization: 'Bearer ' + accessToken } },
  )
  return data.user
}

export async function changeAccountPasswordRequest(
  input: ChangeAccountPasswordInput,
  accessToken: string,
): Promise<ChangeAccountPasswordResult> {
  const { data } = await axiosInstance.patch<ChangeAccountPasswordResult>(
    '/account/password',
    input,
    { headers: { Authorization: 'Bearer ' + accessToken } },
  )
  return data
}
