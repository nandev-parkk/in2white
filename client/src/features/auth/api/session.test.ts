import { axiosInstance } from '@/shared/api'

import { logoutRequest, refreshAccessTokenRequest } from './session'

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
}))

describe('refreshAccessTokenRequest', () => {
  it('requests a new access token with the refresh cookie', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: {
        accessToken: 'token-2',
        user: { id: '1', name: '테스터', email: 'user@in2white.team' },
      },
    })

    await expect(refreshAccessTokenRequest()).resolves.toEqual({
      accessToken: 'token-2',
      user: { id: '1', name: '테스터', email: 'user@in2white.team' },
    })
    expect(axiosInstance.post).toHaveBeenCalledWith('/auth/refresh')
  })
})

describe('logoutRequest', () => {
  it('revokes the current refresh session', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: undefined })

    await logoutRequest()

    expect(axiosInstance.post).toHaveBeenCalledWith('/auth/logout')
  })
})
