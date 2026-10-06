import { axiosInstance } from '@/shared/api'

import { loginRequest } from './login'

vi.mock('@/shared/api', () => ({
  axiosInstance: { post: vi.fn() },
}))

describe('loginRequest', () => {
  it('posts the credentials to /auth/login and returns the response data', async () => {
    const responseData = {
      accessToken: 'token-1',
      user: { id: '1', name: '테스터', email: 'user@in2white.team' },
    }
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({ data: responseData })

    const result = await loginRequest('user@in2white.team', 'password123')

    expect(axiosInstance.post).toHaveBeenCalledWith('/auth/login', {
      email: 'user@in2white.team',
      password: 'password123',
    })
    expect(result).toEqual(responseData)
  })
})
