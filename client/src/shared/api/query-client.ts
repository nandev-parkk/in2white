import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
  maxRetries = 1,
) {
  if (isAxiosError(error) && error.response?.status === 429) return false
  return failureCount < maxRetries
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: shouldRetryQuery,
    },
  },
})
