import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import { Search as SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'

import type {
  ChangeAccountPasswordInput,
  UpdateAccountInput,
} from '@/entities/account'
import { useSessionStore } from '@/entities/session'
import type { WorkspaceSummary } from '@/entities/workspace'
import {
  AccountPasswordForm,
  AccountProfileForm,
  getAccountApiError,
  useAccount,
  useChangeAccountPassword,
  useUpdateAccount,
} from '@/features/account'
import { AuthenticatedWorkspaceLayout } from '@/pages/shared/ui/AuthenticatedWorkspaceLayout'
import { MESSAGES } from '@/shared/constants/messages'
import { Avatar, AvatarFallback } from '@in2white/ui/avatar'
import { Button } from '@in2white/ui/button'
import { ErrorState } from '@in2white/ui/error-state'
import { DelayedLoading } from '@in2white/ui/loading-state'
import { Input } from '@in2white/ui/input'
import { ListCell } from '@in2white/ui/list-cell'
import { PageHeader } from '@in2white/ui/page-header'
import { SkeletonListCell } from '@in2white/ui/skeleton'
import type { SidebarNavKey } from '@/widgets/sidebar'
import { toast } from '@in2white/ui/toast'

export type AccountPageProps = {
  workspaceId?: string
  onWorkspaceChange?: (workspaceId: string) => void
  onNavChange?: (key: SidebarNavKey, selectedWorkspaceId: string | null) => void
}

function getWorkspaceRoleLabel(workspace: WorkspaceSummary) {
  return workspace.role === 'owner'
    ? MESSAGES.member.role.owner
    : MESSAGES.member.role.member
}

function AccountContent({
  accessToken,
  onNavChange,
  selectedWorkspaceId,
  user: sessionUser,
  workspaces,
  workspaceError,
  workspaceLoading,
  refetchWorkspaces,
}: {
  accessToken: string
  onNavChange?: AccountPageProps['onNavChange']
  selectedWorkspaceId: string | null
  user: NonNullable<ReturnType<typeof useSessionStore.getState>['user']>
  workspaces: WorkspaceSummary[]
  workspaceLoading: boolean
  workspaceError: boolean
  refetchWorkspaces: () => Promise<unknown>
}) {
  const navigate = useNavigate()
  const account = useAccount(accessToken, sessionUser.id)
  const updateAccount = useUpdateAccount(accessToken, sessionUser.id)
  const changePassword = useChangeAccountPassword(accessToken, sessionUser.id)
  const [profileError, setProfileError] = useState<string>()
  const [passwordError, setPasswordError] = useState<string>()
  const [profileFormKey, setProfileFormKey] = useState(0)
  const [passwordFormKey, setPasswordFormKey] = useState(0)
  const [workspaceSearch, setWorkspaceSearch] = useState('')
  const displayUser = account.data ?? sessionUser
  const normalizedWorkspaceSearch = workspaceSearch.trim().toLocaleLowerCase()
  const filteredWorkspaces = workspaces.filter((workspace) =>
    workspace.name.toLocaleLowerCase().includes(normalizedWorkspaceSearch),
  )

  async function handleProfileSubmit(input: UpdateAccountInput) {
    setProfileError(undefined)

    try {
      await updateAccount.mutateAsync(input)
      setProfileFormKey((current) => current + 1)
      toast.success(MESSAGES.account.toast.nameUpdated)
    } catch (error) {
      setProfileError(getAccountApiError(error).message)
    }
  }

  async function handlePasswordSubmit(input: ChangeAccountPasswordInput) {
    setPasswordError(undefined)

    try {
      await changePassword.mutateAsync(input)
      setPasswordFormKey((current) => current + 1)
      toast.success(MESSAGES.account.toast.passwordUpdated)
    } catch (error) {
      const accountError = getAccountApiError(error)

      if (accountError.code === 'PASSWORD_CHANGED_REAUTH_REQUIRED') {
        useSessionStore.getState().clearSession()
        toast.error(accountError.message)
        await navigate({ to: '/login', replace: true })
        return
      }

      setPasswordError(accountError.message)
    }
  }

  function handleWorkspaceNavigate(workspaceId: string) {
    if (onNavChange) {
      onNavChange('projects', workspaceId)
      return
    }

    void navigate({
      to: '/workspaces/$workspaceId/projects',
      params: { workspaceId },
    })
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <PageHeader
        className="max-sm:pl-2"
        title={MESSAGES.account.heading.page}
      />

      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-10">
        {account.isError && (
          <div className="flex items-center justify-between gap-4" role="alert">
            <p className="text-status-danger text-[12px]">
              {MESSAGES.account.error.loadFailed}
            </p>
            <Button variant="secondary" onClick={() => void account.refetch()}>
              {MESSAGES.common.action.retry}
            </Button>
          </div>
        )}

        <section
          className="flex flex-col gap-4"
          aria-labelledby="account-profile-title"
        >
          <h2
            id="account-profile-title"
            className="text-foreground-strong text-[18px] font-semibold"
          >
            {MESSAGES.account.heading.profileSection}
          </h2>
          <AccountProfileForm
            key={`${displayUser.id}-${profileFormKey}`}
            user={displayUser}
            onSubmit={handleProfileSubmit}
            loading={updateAccount.isPending}
            error={profileError}
          />
        </section>

        <section
          className="flex flex-col gap-4"
          aria-labelledby="account-password-title"
        >
          <h2
            id="account-password-title"
            className="text-foreground-strong text-[18px] font-semibold"
          >
            {MESSAGES.account.heading.passwordSection}
          </h2>
          <AccountPasswordForm
            key={passwordFormKey}
            onSubmit={handlePasswordSubmit}
            loading={changePassword.isPending}
            error={passwordError}
          />
        </section>

        <section
          className="flex flex-col gap-4"
          aria-labelledby="account-workspaces-title"
        >
          <h2
            id="account-workspaces-title"
            className="text-foreground-strong text-[18px] font-semibold"
          >
            {MESSAGES.account.heading.workspaceSection}
          </h2>
          {workspaceLoading ? (
            <DelayedLoading>
              <div role="status" aria-label={MESSAGES.workspace.a11y.loading}>
                <span className="sr-only">
                  {MESSAGES.workspace.a11y.loading}
                </span>
                {Array.from({ length: 3 }, (_, index) => (
                  <SkeletonListCell key={index} aria-hidden="true" />
                ))}
              </div>
            </DelayedLoading>
          ) : workspaceError ? (
            <ErrorState
              size="compact"
              title={MESSAGES.workspace.error.loadFailed}
              action={
                <Button
                  variant="secondary"
                  onClick={() => void refetchWorkspaces()}
                >
                  {MESSAGES.common.action.retry}
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <SearchIcon className="text-foreground-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  aria-label={MESSAGES.workspace.form.searchPlaceholder}
                  placeholder={MESSAGES.workspace.form.searchPlaceholder}
                  value={workspaceSearch}
                  onChange={(event) => setWorkspaceSearch(event.target.value)}
                  className="bg-background-subtle rounded-full border-transparent pl-9 focus:border-transparent"
                />
              </div>
              <div
                data-testid="account-workspaces-list"
                className="max-h-[248px] overflow-y-auto"
              >
                {filteredWorkspaces.map((workspace) => {
                  const roleLabel = getWorkspaceRoleLabel(workspace)

                  return (
                    <ListCell
                      key={workspace.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${workspace.name} ${roleLabel}`}
                      className={
                        workspace.id === selectedWorkspaceId
                          ? 'bg-background-subtle rounded-md'
                          : undefined
                      }
                      leading={
                        <Avatar size="default">
                          <AvatarFallback size="default">
                            {workspace.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                      }
                      title={workspace.name}
                      subtitle={roleLabel}
                      onClick={() => handleWorkspaceNavigate(workspace.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          handleWorkspaceNavigate(workspace.id)
                        }
                      }}
                    />
                  )
                })}
                {filteredWorkspaces.length === 0 && (
                  <p className="text-body-small text-foreground-tertiary px-2 py-4 text-center">
                    {MESSAGES.workspace.empty.title}
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export function AccountPage({
  workspaceId,
  onWorkspaceChange,
  onNavChange,
}: AccountPageProps = {}) {
  useDocumentTitle('in2white | 계정')

  return (
    <AuthenticatedWorkspaceLayout
      workspaceId={workspaceId}
      activeNav={null}
      unknownWorkspace="fallback"
      workspaceMode="optional"
      onWorkspaceChange={onWorkspaceChange}
      onNavChange={onNavChange}
    >
      {({
        accessToken,
        selectedWorkspaceId,
        user,
        workspaces,
        workspaceError,
        workspaceLoading,
        refetchWorkspaces,
      }) => (
        <AccountContent
          accessToken={accessToken}
          onNavChange={onNavChange}
          selectedWorkspaceId={selectedWorkspaceId}
          user={user}
          workspaces={workspaces}
          workspaceError={workspaceError}
          workspaceLoading={workspaceLoading}
          refetchWorkspaces={refetchWorkspaces}
        />
      )}
    </AuthenticatedWorkspaceLayout>
  )
}
