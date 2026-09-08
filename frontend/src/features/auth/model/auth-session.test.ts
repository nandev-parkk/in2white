import { useSessionStore } from '@/entities/session'

import { refreshAccessTokenRequest } from '../api/session'
import { refreshAccessToken } from './auth-session'

vi.mock('../api/session', () => ({
  refreshAccessTokenRequest: vi.fn(),
}))

describe('refreshAccessToken', () => {
  beforeEach(() => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
  })

  afterEach(() => {
    useSessionStore.getState().clearSession()
    vi.clearAllMocks()
  })

  it('stores the refreshed token and keeps the current user', async () => {
    vi.mocked(refreshAccessTokenRequest).mockResolvedValueOnce({
      accessToken: 'token-2',
    })

    await expect(refreshAccessToken()).resolves.toBe('token-2')

    expect(useSessionStore.getState()).toMatchObject({
      accessToken: 'token-2',
      user: { id: '1', name: '테스터', email: 'user@in2white.team' },
    })
  })

  it('shares one refresh request between concurrent callers', async () => {
    let resolveRefresh!: (value: { accessToken: string }) => void
    vi.mocked(refreshAccessTokenRequest).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve
      }),
    )

    const first = refreshAccessToken()
    const second = refreshAccessToken()
    resolveRefresh({ accessToken: 'token-2' })

    await expect(Promise.all([first, second])).resolves.toEqual([
      'token-2',
      'token-2',
    ])
    expect(refreshAccessTokenRequest).toHaveBeenCalledOnce()
  })

  it('propagates refresh failure without retrying it', async () => {
    const error = new Error('refresh failed')
    vi.mocked(refreshAccessTokenRequest).mockRejectedValueOnce(error)

    await expect(refreshAccessToken()).rejects.toBe(error)
    expect(refreshAccessTokenRequest).toHaveBeenCalledOnce()
  })
})
