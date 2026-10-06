import { axiosInstance } from '@/shared/api'

import {
  changeAccountPasswordRequest,
  getAccountRequest,
  updateAccountRequest,
  type AccountUser,
} from './account'

vi.mock('@/shared/api', () => ({
  axiosInstance: { get: vi.fn(), patch: vi.fn() },
}))

const accountUser: AccountUser = {
  id: 'user-1',
  name: '김민지',
  email: 'minji@example.com',
}

describe('account API requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('계정 조회는 user envelope를 벗기고 bearer token을 전달한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { user: accountUser },
    })

    await expect(getAccountRequest('token-1')).resolves.toEqual(accountUser)
    expect(axiosInstance.get).toHaveBeenCalledWith('/account', {
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('계정 조회는 query 취소 signal을 axios에 전달한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({
      data: { user: accountUser },
    })
    const signal = new AbortController().signal

    await getAccountRequest('token-1', signal)

    expect(axiosInstance.get).toHaveBeenCalledWith('/account', {
      headers: { Authorization: 'Bearer token-1' },
      signal,
    })
  })

  it('이름 변경은 PATCH /account로 name만 전송한다', async () => {
    vi.mocked(axiosInstance.patch).mockResolvedValue({
      data: { user: accountUser },
    })

    await updateAccountRequest({ name: '새 이름' }, 'token-1')

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      '/account',
      { name: '새 이름' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('비밀번호 확인 값은 API body에 포함하지 않는다', async () => {
    vi.mocked(axiosInstance.patch).mockResolvedValue({
      data: { accessToken: 'token-2', user: accountUser },
    })

    await changeAccountPasswordRequest(
      { currentPassword: 'Old123!', newPassword: 'New12345!' },
      'token-1',
    )

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      '/account/password',
      { currentPassword: 'Old123!', newPassword: 'New12345!' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
    expect(
      vi.mocked(axiosInstance.patch).mock.calls[0]?.[1],
    ).not.toHaveProperty('confirmPassword')
  })
})
