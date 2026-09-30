import axios from 'axios'

import { env } from '@/shared/config/env'

/*
 * 어드민 API는 모두 `/admin` 아래에 있다. baseURL에 붙여두면 호출부마다 접두사를
 * 반복하지 않고, 제품 경로를 실수로 호출하는 것도 막힌다.
 */
export const axiosInstance = axios.create({
  baseURL: `${env.apiBaseUrl}/admin`,
  timeout: 10_000,
  withCredentials: true,
})
