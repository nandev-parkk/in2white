import { useSessionStore } from '@/entities/session'

import { redirectIfUnauthenticated } from './index'

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

const user = { id: '1', name: '테스터', email: 'user@in2white.team' }

describe('redirectIfUnauthenticated', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
    mockRefreshAccessToken.mockReset()
  })

  it('세션이 없으면 로그인 페이지로 보낸다', async () => {
    await expect(redirectIfUnauthenticated()).rejects.toMatchObject({
      options: { to: '/login' },
    })
  })

  it('유효한 세션이 있으면 홈 진입을 허용한다', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), user)

    await expect(redirectIfUnauthenticated()).resolves.toBeUndefined()
  })

  it('만료된 세션은 refresh 성공 후 홈 진입을 허용한다', async () => {
    useSessionStore.getState().setSession(createToken(1), user)
    mockRefreshAccessToken.mockImplementationOnce(async () => {
      useSessionStore.getState().updateAccessToken('token-2')
      return 'token-2'
    })

    await expect(redirectIfUnauthenticated()).resolves.toBeUndefined()
    expect(useSessionStore.getState().accessToken).toBe('token-2')
  })

  it('만료된 세션의 refresh 실패 시 로그인 페이지로 보낸다', async () => {
    useSessionStore.getState().setSession(createToken(1), user)
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('expired'))

    await expect(redirectIfUnauthenticated()).rejects.toMatchObject({
      options: { to: '/login' },
    })
    expect(useSessionStore.getState().accessToken).toBeNull()
  })
})
