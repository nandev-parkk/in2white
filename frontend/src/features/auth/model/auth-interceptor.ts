import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

import { isAccessTokenExpired, useSessionStore } from '@/entities/session'
import { axiosInstance } from '@/shared/api'

import { refreshAccessToken } from './auth-session'

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
    useSessionStore.getState().clearSession()
    onSessionExpired()
  }

  const requestInterceptor = axiosInstance.interceptors.request.use(
    async (config) => {
      if (isLoginOrRefreshRequest(config.url)) return config

      let accessToken = useSessionStore.getState().accessToken
      if (accessToken && isAccessTokenExpired(accessToken)) {
        try {
          accessToken = await refreshAccessToken()
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
        const accessToken = await refreshAccessToken()
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
