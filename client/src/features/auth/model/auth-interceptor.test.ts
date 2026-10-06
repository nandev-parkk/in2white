import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useSessionStore } from '@/entities/session'
import { axiosInstance } from '@/shared/api'

import { configureAuthInterceptors } from './auth-interceptor'

const mockRefreshAccessToken = vi.fn()

function createToken(exp: number) {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.signature`
}

vi.mock('./auth-session', () => ({
  refreshAccessToken: (...args: unknown[]) => mockRefreshAccessToken(...args),
}))

function getLatestRequestFulfilled() {
  const handlers = axiosInstance.interceptors.request.handlers ?? []
  return handlers[handlers.length - 1]?.fulfilled
}

function getLatestResponseRejected() {
  const handlers = axiosInstance.interceptors.response.handlers ?? []
  return handlers[handlers.length - 1]?.rejected
}

describe('configureAuthInterceptors', () => {
  afterEach(() => {
    useSessionStore.getState().clearSession()
    mockRefreshAccessToken.mockReset()
    vi.restoreAllMocks()
  })

  it('adds the current access token to protected requests', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    const cleanup = configureAuthInterceptors({ onSessionExpired: vi.fn() })

    const config = await getLatestRequestFulfilled()!({
      url: '/workspaces',
      headers: {},
    } as InternalAxiosRequestConfig)

    expect(config.headers.Authorization).toBe(
      `Bearer ${useSessionStore.getState().accessToken}`,
    )
    cleanup()
  })

  it('refreshes an expired access token before a protected request', async () => {
    useSessionStore.getState().setSession(createToken(1), {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    mockRefreshAccessToken.mockImplementationOnce(async () => {
      useSessionStore.getState().updateAccessToken('token-2')
      return 'token-2'
    })
    const cleanup = configureAuthInterceptors({ onSessionExpired: vi.fn() })

    const config = await getLatestRequestFulfilled()!({
      url: '/workspaces',
      headers: {},
    } as InternalAxiosRequestConfig)

    expect(mockRefreshAccessToken).toHaveBeenCalledOnce()
    expect(config.headers.Authorization).toBe('Bearer token-2')
    cleanup()
  })

  it('refreshes a protected request once after a 401 response', async () => {
    useSessionStore.getState().setSession(createToken(2_000_000_000), {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    mockRefreshAccessToken.mockResolvedValueOnce('token-2')
    const retry = vi
      .spyOn(axiosInstance, 'request')
      .mockResolvedValueOnce({ data: 'ok' })
    const cleanup = configureAuthInterceptors({ onSessionExpired: vi.fn() })
    const rejected = getLatestResponseRejected()!
    const config = {
      url: '/workspaces',
      headers: { Authorization: 'Bearer token-1' },
    } as InternalAxiosRequestConfig
    const error = {
      config,
      response: { status: 401 },
    } as unknown as AxiosError

    await expect(rejected(error)).resolves.toEqual({ data: 'ok' })

    expect(mockRefreshAccessToken).toHaveBeenCalledOnce()
    expect(retry).toHaveBeenCalledOnce()
    expect(config.headers.Authorization).toBe('Bearer token-2')
    cleanup()
  })

  it('clears the session and redirects when refresh fails', async () => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    const onSessionExpired = vi.fn()
    mockRefreshAccessToken.mockRejectedValueOnce(new Error('expired'))
    const cleanup = configureAuthInterceptors({ onSessionExpired })
    const rejected = getLatestResponseRejected()!
    const error = {
      config: {
        url: '/workspaces',
        headers: {},
      },
      response: { status: 401 },
    } as unknown as AxiosError

    await expect(rejected(error)).rejects.toThrow('expired')

    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(onSessionExpired).toHaveBeenCalledOnce()
    cleanup()
  })

  it('does not refresh a failed login request', async () => {
    const cleanup = configureAuthInterceptors({ onSessionExpired: vi.fn() })
    const rejected = getLatestResponseRejected()!
    const error = {
      config: { url: '/auth/login', headers: {} },
      response: { status: 401 },
    } as unknown as AxiosError

    await expect(rejected(error)).rejects.toBe(error)

    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    cleanup()
  })

  it('expires the session when the retried request still returns 401', async () => {
    useSessionStore.getState().setSession('token-1', {
      id: '1',
      name: '테스터',
      email: 'user@in2white.team',
    })
    const onSessionExpired = vi.fn()
    const cleanup = configureAuthInterceptors({ onSessionExpired })
    const rejected = getLatestResponseRejected()!
    const error = {
      config: {
        url: '/workspaces',
        headers: {},
        _authRetry: true,
      },
      response: { status: 401 },
    } as unknown as AxiosError

    await expect(rejected(error)).rejects.toBe(error)

    expect(useSessionStore.getState().accessToken).toBeNull()
    expect(onSessionExpired).toHaveBeenCalledOnce()
    cleanup()
  })
})
