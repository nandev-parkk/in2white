import axios from 'axios'

import { env } from '@/shared/config/env'

export const axiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 10_000,
  withCredentials: true,
})
