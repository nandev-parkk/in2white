import { useSessionStore } from '@/entities/session'

import { redirectIfUnauthenticated } from './index'

describe('redirectIfUnauthenticated', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
  })

  it('세션이 없으면 로그인 페이지로 보낸다', () => {
    expect(() => redirectIfUnauthenticated()).toThrow()
  })

  it('세션이 있으면 홈 진입을 허용한다', () => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })

    expect(() => redirectIfUnauthenticated()).not.toThrow()
  })
})
