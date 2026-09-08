import { useSessionStore } from '@/entities/session'

import { redirectIfUnauthenticated } from './__root'

const mockRefreshAccessToken = vi.fn()

vi.mock('@/features/auth/model/auth-session', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}))

const user = { id: '1', name: '테스터', email: 'user@in2white.team' }

function createToken(exp: number) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
}

describe('root authentication guard', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
    mockRefreshAccessToken.mockReset()
  })

  it('allows the login route without a session', async () => {
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('no refresh cookie'))

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).resolves.toBeUndefined()
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce()
  })

  it('clears an expired session before allowing the login route', async () => {
    useSessionStore.getState().setSession(createToken(1), user)
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('expired'))

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).resolves.toBeUndefined()
    expect(useSessionStore.getState()).toMatchObject({
      accessToken: null,
      user: null,
    })
  })

  it('blocks every non-login route without a session', async () => {
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('expired'))

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/settings' } }),
    ).rejects.toMatchObject({ options: { to: '/login' } })
  })

  it('restores a missing in-memory session before allowing a protected route', async () => {
    mockRefreshAccessToken.mockImplementationOnce(async () => {
      useSessionStore.getState().setSession(createToken(2_000_000_000), user)
      return 'restored-token'
    })

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/' } }),
    ).resolves.toBeUndefined()
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce()
  })

  it('redirects a restored session away from the login route', async () => {
    mockRefreshAccessToken.mockImplementationOnce(async () => {
      useSessionStore.getState().setSession(createToken(2_000_000_000), user)
      return 'restored-token'
    })

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).rejects.toMatchObject({ options: { to: '/' } })
  })

  it('redirects an existing session away from the login route', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), user)

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).rejects.toMatchObject({ options: { to: '/' } })
    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
  })
})
