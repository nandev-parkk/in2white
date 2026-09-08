import { isAccessTokenExpired, useSessionStore } from './session-store'

function createToken(exp: number) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
}

describe('useSessionStore', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
  })

  it('starts with no session', () => {
    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
  })

  it('stores the access token and user on setSession', () => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    expect(useSessionStore.getState().accessToken).toBe('token-1')
    expect(useSessionStore.getState().user).toEqual({
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
  })

  it('clears the session on clearSession', () => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    useSessionStore.getState().clearSession()

    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
  })

  it('recognizes an access token that is still valid', () => {
    expect(isAccessTokenExpired(createToken(2_000), 1_000)).toBe(false)
  })

  it('recognizes an access token that has expired', () => {
    expect(isAccessTokenExpired(createToken(1_000), 1_000)).toBe(true)
  })

  it('treats a malformed access token as expired', () => {
    expect(isAccessTokenExpired('not-a-jwt', 1_000)).toBe(true)
  })

  it('updates only the access token while preserving the user', () => {
    const user = { id: '1', name: '테스터', email: 'user@in2white.team' }
    useSessionStore.getState().setSession('token-1', user)

    useSessionStore.getState().updateAccessToken('token-2')

    expect(useSessionStore.getState()).toMatchObject({
      accessToken: 'token-2',
      user,
    })
  })
})
