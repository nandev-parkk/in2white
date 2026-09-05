import type { PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ErrorBoundary } from 'react-error-boundary'

import { queryClient } from '@/shared/api'

function ErrorFallback() {
  return (
    <div role="alert">
      <p>문제가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
    </div>
  )
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        {children}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
