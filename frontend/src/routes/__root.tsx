import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import { redirectIfUnauthenticated } from '@/features/auth/model/route-guards'

export { redirectIfUnauthenticated }

export const Route = createRootRoute({
  beforeLoad: redirectIfUnauthenticated,
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools />}
    </>
  )
}
