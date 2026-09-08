import { useSessionStore } from '@/entities/session'

import { redirectIfUnauthenticated } from './__root'

describe('root authentication guard', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
  })

  it('allows the login route without a session', async () => {
    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).resolves.toBeUndefined()
  })

  it('blocks every non-login route without a session', async () => {
    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/settings' } }),
    ).rejects.toMatchObject({ options: { to: '/login' } })
  })
})
