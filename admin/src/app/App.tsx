import { RouterProvider } from '@tanstack/react-router'

import { AppProviders } from './providers/AppProviders'
import { router } from './router'
import { configureAuthInterceptors } from '@/features/auth'

configureAuthInterceptors({
  onSessionExpired: () => {
    void router.navigate({ to: '/login', replace: true })
  },
})

function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

export default App
