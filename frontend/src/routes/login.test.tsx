import { useSessionStore } from '@/entities/session'

import { redirectIfAuthenticated } from './login'

describe('redirectIfAuthenticated', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
  })

  it('does nothing when there is no session', () => {
    expect(() => redirectIfAuthenticated()).not.toThrow()
  })

  it('redirects to / when a session already exists', () => {
    useSessionStore
      .getState()
      .setSession('token-1', {
        id: '1',
        name: '테스터',
        email: 'user@in2white.team',
      })

    expect(() => redirectIfAuthenticated()).toThrow()
  })
})
