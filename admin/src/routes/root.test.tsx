import { useAdminSessionStore } from '@/entities/admin-session'

import { redirectIfUnauthenticated } from './__root'

const mockRefreshAdminAccessToken = vi.fn()

vi.mock('@/features/auth/model/auth-session', () => ({
  refreshAdminAccessToken: (...args: unknown[]) =>
    mockRefreshAdminAccessToken(...args),
}))

const admin = { id: 'admin-1', email: 'admin@in2white.team' }

function createToken(exp: number) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
}

describe('어드민 인증 가드', () => {
  afterEach(() => {
    useAdminSessionStore.getState().clearSession()
    mockRefreshAdminAccessToken.mockReset()
  })

  it('세션이 없으면 보호된 라우트를 /login으로 보낸다', async () => {
    mockRefreshAdminAccessToken.mockRejectedValueOnce(new Error('no cookie'))

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/' } }),
    ).rejects.toMatchObject({ options: { to: '/login' } })
  })

  it('세션이 없어도 /login은 통과시킨다', async () => {
    mockRefreshAdminAccessToken.mockRejectedValueOnce(new Error('no cookie'))

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).resolves.toBeUndefined()
    expect(mockRefreshAdminAccessToken).toHaveBeenCalledOnce()
  })

  /* 새로고침으로 메모리 토큰이 사라져도 refresh 쿠키가 있으면 세션을 복구한다. */
  it('refresh로 세션을 복구하면 보호된 라우트를 통과시킨다', async () => {
    mockRefreshAdminAccessToken.mockImplementationOnce(async () => {
      const token = createToken(2_000_000_000)
      useAdminSessionStore.getState().setSession(token, admin)
      return token
    })

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/' } }),
    ).resolves.toBeUndefined()
  })

  it('만료된 세션은 /login을 허용하기 전에 비운다', async () => {
    useAdminSessionStore.getState().setSession(createToken(1), admin)
    mockRefreshAdminAccessToken.mockRejectedValueOnce(new Error('expired'))

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).resolves.toBeUndefined()
    expect(useAdminSessionStore.getState()).toMatchObject({
      accessToken: null,
      admin: null,
    })
  })

  it('이미 로그인한 세션은 /login에서 /로 돌려보낸다', async () => {
    useAdminSessionStore
      .getState()
      .setSession(createToken(2_000_000_000), admin)

    await expect(
      redirectIfUnauthenticated({ location: { pathname: '/login' } }),
    ).rejects.toMatchObject({ options: { to: '/' } })
    expect(mockRefreshAdminAccessToken).not.toHaveBeenCalled()
  })
})
