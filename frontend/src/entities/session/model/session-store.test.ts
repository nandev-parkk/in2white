import { useSessionStore } from './session-store'

describe('useSessionStore', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
  })

  it('starts with no session', () => {
    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
  })

  it('stores the access token and user on setSession', () => {
    useSessionStore
      .getState()
      .setSession('token-1', {
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
    useSessionStore
      .getState()
      .setSession('token-1', {
        id: '1',
        name: '테스터',
        email: 'user@in2white.team',
      })

    useSessionStore.getState().clearSession()

    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(useSessionStore.getState().user).toBeNull()
  })
})
