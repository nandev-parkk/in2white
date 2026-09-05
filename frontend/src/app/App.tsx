import { RouterProvider } from '@tanstack/react-router'

import { AppProviders } from './providers/AppProviders'
import { router } from './router'

function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

export default App
