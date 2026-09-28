import type { PropsWithChildren } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ErrorBoundary } from 'react-error-boundary'

import { queryClient } from '@/shared/api'
import { Toaster } from '@/shared/ui/toast'
import { MESSAGES } from '@/shared/constants/messages'

function ErrorFallback() {
  return (
    <div role="alert">
      <p>{MESSAGES.common.error.unexpected}</p>
    </div>
  )
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
