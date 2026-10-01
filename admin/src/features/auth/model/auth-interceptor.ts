import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

import {
  isAccessTokenExpired,
  useAdminSessionStore,
} from '@/entities/admin-session'
import { axiosInstance } from '@/shared/api'

import { refreshAdminAccessToken } from './auth-session'

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _authRetry?: boolean
}

interface AuthInterceptorOptions {
  onSessionExpired: () => void
}

function isLoginOrRefreshRequest(url?: string) {
  return url?.includes('/auth/login') || url?.includes('/auth/refresh')
}

function setAuthorizationHeader(
  config: InternalAxiosRequestConfig,
  accessToken: string,
) {
  config.headers.Authorization = `Bearer ${accessToken}`
}

export function configureAuthInterceptors({
  onSessionExpired,
}: AuthInterceptorOptions) {
  let sessionExpired = false

  const expireSession = () => {
    if (sessionExpired) return

    sessionExpired = true
    useAdminSessionStore.getState().clearSession()
    onSessionExpired()
  }

  const requestInterceptor = axiosInstance.interceptors.request.use(
    async (config) => {
      if (isLoginOrRefreshRequest(config.url)) return config

      let accessToken = useAdminSessionStore.getState().accessToken
      if (accessToken && isAccessTokenExpired(accessToken)) {
        try {
          accessToken = await refreshAdminAccessToken()
          sessionExpired = false
        } catch (error) {
          expireSession()
          throw error
        }
      }

      if (accessToken) setAuthorizationHeader(config, accessToken)
      return config
    },
  )

  const responseInterceptor = axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config as RetriableRequestConfig | undefined

      /*
       * 401만 재시도한다. 로그인·refresh 요청 자체의 실패를 재시도하면 회전된 토큰이
       * 서로를 폐기해 정상 세션까지 죽는다.
       */
      if (
        error.response?.status !== 401 ||
        !config ||
        isLoginOrRefreshRequest(config.url)
      ) {
        throw error
      }

      if (config._authRetry) {
        expireSession()
        throw error
      }

      try {
        const accessToken = await refreshAdminAccessToken()
        sessionExpired = false
        config._authRetry = true
        setAuthorizationHeader(config, accessToken)
        return axiosInstance.request(config)
      } catch (refreshError) {
        expireSession()
        throw refreshError
      }
    },
  )

  return () => {
    axiosInstance.interceptors.request.eject(requestInterceptor)
    axiosInstance.interceptors.response.eject(responseInterceptor)
  }
}
