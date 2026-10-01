import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

/*
 * 4xx는 다시 보내도 같은 응답이 온다. 없는 사용자나 잘못된 요청을 재시도하면 오류를
 * 늦게 보여줄 뿐이다. 만료된 토큰은 axios 인터셉터가 갱신 후 한 번 다시 보낸다.
 */
function retryQuery(failureCount: number, error: Error) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status !== undefined && status >= 400 && status < 500) return false

  return failureCount < 1
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: retryQuery,
    },
  },
})
