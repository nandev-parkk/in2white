import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { AccountPage } from '@/pages/account'

import { redirectIfUnauthenticated } from './index'
import { WORKSPACE_NAV_ROUTES } from './workspaces/$workspaceId/-route-paths'

export const ACCOUNT_ROUTE = '/account' as const

export const Route = createFileRoute('/account')({
  beforeLoad: redirectIfUnauthenticated,
  validateSearch: (search: Record<string, unknown>) => ({
    workspaceId:
      typeof search.workspaceId === 'string' ? search.workspaceId : undefined,
  }),
  component: AccountRoute,
})

function AccountRoute() {
  const { workspaceId } = Route.useSearch()
  const navigate = useNavigate()

  return (
    <AccountPage
      workspaceId={workspaceId}
      onWorkspaceChange={(nextWorkspaceId) =>
        navigate({
          to: ACCOUNT_ROUTE,
          search: { workspaceId: nextWorkspaceId },
          replace: true,
        })
      }
      onNavChange={(key, selectedWorkspaceId) => {
        if (!selectedWorkspaceId) return

        void navigate({
          to: WORKSPACE_NAV_ROUTES[key],
          params: { workspaceId: selectedWorkspaceId },
        })
      }}
    />
  )
}
