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
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { ListCell } from '@/shared/ui/list-cell'
import { PageHeader } from '@/shared/ui/page-header'
import type { SidebarNavKey } from '@/shared/ui/sidebar'
import { toast } from '@/shared/ui/toast'

export type AccountPageProps = {
  workspaceId?: string
  onWorkspaceChange?: (workspaceId: string) => void
  onNavChange?: (key: SidebarNavKey, selectedWorkspaceId: string | null) => void
}

function getWorkspaceRoleLabel(workspace: WorkspaceSummary) {
  return workspace.role === 'owner' ? '소유자' : '멤버'
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
      toast.success(MESSAGES.ACCOUNT_UPDATED)
    } catch (error) {
      setProfileError(getAccountApiError(error).message)
    }
  }

  async function handlePasswordSubmit(input: ChangeAccountPasswordInput) {
    setPasswordError(undefined)

    try {
      await changePassword.mutateAsync(input)
      setPasswordFormKey((current) => current + 1)
      toast.success(MESSAGES.PASSWORD_UPDATED)
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
    <div className="flex w-full flex-col gap-7">
      <PageHeader className="max-sm:pl-2" title="계정 설정" />

      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-10">
        {account.isError && (
          <div className="flex items-center justify-between gap-4" role="alert">
            <p className="text-status-danger text-[12px]">
              {MESSAGES.ACCOUNT_LOAD_FAILED}
            </p>
            <Button variant="secondary" onClick={() => void account.refetch()}>
              다시 시도
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
            기본 정보
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
            비밀번호 변경
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
            참여 워크스페이스
          </h2>
          {workspaceLoading ? (
            <p className="text-foreground-secondary text-[12px]">
              워크스페이스 불러오는 중
            </p>
          ) : workspaceError ? (
            <div
              className="flex items-center justify-between gap-4"
              role="alert"
            >
              <p className="text-status-danger text-[12px]">
                워크스페이스를 불러오지 못했어요
              </p>
              <Button
                variant="secondary"
                onClick={() => void refetchWorkspaces()}
              >
                다시 시도
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <SearchIcon className="text-foreground-tertiary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  type="search"
                  aria-label="워크스페이스 검색"
                  placeholder="워크스페이스 검색"
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
                    워크스페이스가 없습니다
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
