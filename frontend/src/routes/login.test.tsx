import { useSessionStore } from '@/entities/session'

import { redirectIfAuthenticated } from './login'

const mockRefreshAccessToken = vi.fn()

vi.mock('@/features/auth/model/auth-session', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}))

function createToken(exp: number) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
}

describe('redirectIfAuthenticated', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
    mockRefreshAccessToken.mockReset()
  })

  it('does nothing when there is no session', async () => {
    await expect(redirectIfAuthenticated()).resolves.toBeUndefined()
  })

  it('redirects to / when a valid session already exists', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    await expect(redirectIfAuthenticated()).rejects.toMatchObject({
      options: { to: '/' },
    })
  })

  it('allows the login page after an expired session refresh fails', async () => {
    useSessionStore.getState().setSession(createToken(1), {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('expired'))

    await expect(redirectIfAuthenticated()).resolves.toBeUndefined()
    expect(useSessionStore.getState().accessToken).toBeNull()
  })
})
