import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'

import type { AdminUserWorkspace, UpdateUserInput } from '@/entities/user'
import {
  UserDeleteDialog,
  UserEditDialog,
  UserPasswordResetDialog,
  UserStatusBadge,
  isUserNotFound,
  useDeactivateUser,
  useDeleteUser,
  useReactivateUser,
  useResetUserPassword,
  useRevokeUserSessions,
  useUpdateUser,
  useUser,
  useUserDeletionImpact,
} from '@/features/user'
import { MESSAGES } from '@/shared/constants/messages'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { Button } from '@in2white/ui/button'
import { Badge } from '@in2white/ui/badge'
import { ConfirmDialog } from '@in2white/ui/confirm-dialog'
import { ErrorState } from '@in2white/ui/error-state'
import { LoadingState } from '@in2white/ui/loading-state'
import { PageHeader } from '@in2white/ui/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@in2white/ui/table'
import { toast } from '@in2white/ui/toast'
import { formatDate, formatDateTime } from '@/shared/lib/format-date'

type OpenDialog =
  'edit' | 'password' | 'deactivate' | 'reactivate' | 'revoke' | 'delete' | null

type UserDetailPageProps = {
  userId: string
}

function DetailRow({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex gap-3">
      <dt className="text-foreground-secondary w-32 shrink-0 text-[14px] leading-[1.429]">
        {label}
      </dt>
      <dd className="text-foreground-default min-w-0 text-[14px] leading-[1.429]">
        {children}
      </dd>
    </div>
  )
}

function WorkspaceTable({ workspaces }: { workspaces: AdminUserWorkspace[] }) {
  if (workspaces.length === 0) {
    return (
      <p className="text-foreground-secondary text-[14px]">
        {MESSAGES.user.detail.noWorkspace}
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{MESSAGES.common.label.name}</TableHead>
          <TableHead>{MESSAGES.user.column.role}</TableHead>
          <TableHead>{MESSAGES.user.column.joinedAt}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workspaces.map((workspace) => (
          <TableRow key={workspace.id}>
            <TableCell className="flex items-center gap-2">
              <span className="text-foreground-strong truncate font-medium">
                {workspace.name}
              </span>
              {workspace.isDefault && (
                <Badge semantic="neutral">
                  {MESSAGES.user.detail.defaultWorkspace}
                </Badge>
              )}
            </TableCell>
            <TableCell>{MESSAGES.user.role[workspace.role]}</TableCell>
            <TableCell>{formatDate(workspace.joinedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function UserDetailPage({ userId }: UserDetailPageProps) {
  const navigate = useNavigate()
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null)

  const userQuery = useUser(userId)
  const updateUser = useUpdateUser(userId)
  const resetPassword = useResetUserPassword(userId)
  const deactivateUser = useDeactivateUser(userId)
  const reactivateUser = useReactivateUser(userId)
  const revokeSessions = useRevokeUserSessions(userId)
  const deleteUser = useDeleteUser(userId)
  const deletionImpactQuery = useUserDeletionImpact(
    userId,
    openDialog === 'delete',
  )

  const detail = userQuery.data
  const user = detail?.user
  useDocumentTitle(`in2white admin | ${user?.name ?? '사용자 상세'}`)

  function openWith(dialog: Exclude<OpenDialog, null>, reset: () => void) {
    reset()
    setOpenDialog(dialog)
  }

  /* 요청 중에는 닫지 않는다. 결과를 못 본 채 모달이 사라지면 성패를 알 수 없다. */
  function closeDialog(pending: boolean, reset: () => void) {
    return (open: boolean) => {
      if (!open && pending) return
      if (!open) {
        reset()
        setOpenDialog(null)
      }
    }
  }

  async function runAction(
    mutate: () => Promise<unknown>,
    successMessage: string,
    onDone?: () => void,
  ) {
    try {
      await mutate()
      toast.success(successMessage)
      setOpenDialog(null)
      onDone?.()
    } catch {
      return
    }
  }

  if (userQuery.isLoading) {
    return <LoadingState label={MESSAGES.user.a11y.detailLoading} />
  }

  if (userQuery.isError || !detail || !user) {
    const notFound = isUserNotFound(userQuery.error)

    return (
      <ErrorState
        className="min-h-48"
        title={
          notFound
            ? MESSAGES.user.error.notFound
            : MESSAGES.user.error.detailLoadFailed
        }
        action={
          notFound ? undefined : (
            <Button
              variant="secondary"
              onClick={() => void userQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          )
        }
      />
    )
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Link
            to="/users"
            className="text-foreground-secondary text-[14px] leading-[1.429] hover:underline"
          >
            {MESSAGES.user.heading.list}
          </Link>
        }
        title={user.name}
        action={<UserStatusBadge user={user} />}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={() => openWith('edit', updateUser.reset)}
        >
          {MESSAGES.user.action.edit}
        </Button>
        <Button
          variant="secondary"
          onClick={() => openWith('password', resetPassword.reset)}
        >
          {MESSAGES.user.action.resetPassword}
        </Button>
        {user.deactivatedAt === null ? (
          <Button
            variant="secondary"
            onClick={() => openWith('deactivate', deactivateUser.reset)}
          >
            {MESSAGES.user.action.deactivate}
          </Button>
        ) : (
          <Button
            variant="secondary"
            onClick={() => openWith('reactivate', reactivateUser.reset)}
          >
            {MESSAGES.user.action.reactivate}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => openWith('revoke', revokeSessions.reset)}
        >
          {MESSAGES.user.action.revokeSessions}
        </Button>
        <Button
          variant="destructive"
          onClick={() => openWith('delete', deleteUser.reset)}
        >
          {MESSAGES.user.action.delete}
        </Button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
          {MESSAGES.user.detail.basicInfo}
        </h2>
        <dl className="flex flex-col gap-2">
          <DetailRow label={MESSAGES.user.form.emailLabel}>
            {user.email}
          </DetailRow>
          <DetailRow label={MESSAGES.user.column.createdAt}>
            {formatDateTime(user.createdAt)}
          </DetailRow>
          {user.deactivatedAt && (
            <DetailRow label={MESSAGES.user.detail.deactivatedAt}>
              {formatDateTime(user.deactivatedAt)}
            </DetailRow>
          )}
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
          {MESSAGES.user.heading.workspaces}
        </h2>
        <WorkspaceTable workspaces={detail.workspaces} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
          {MESSAGES.user.heading.resources}
        </h2>
        <dl className="flex flex-col gap-2">
          <DetailRow label={MESSAGES.user.detail.createdProjects}>
            {MESSAGES.user.detail.countSuffix(detail.createdProjectCount)}
          </DetailRow>
          <DetailRow label={MESSAGES.user.detail.createdDocuments}>
            {MESSAGES.user.detail.countSuffix(
              detail.createdWhiteboardDocumentCount,
            )}
          </DetailRow>
        </dl>
      </section>

      {openDialog === 'edit' && (
        <UserEditDialog
          open
          user={user}
          onOpenChange={closeDialog(updateUser.isPending, updateUser.reset)}
          onSubmit={(input: UpdateUserInput) =>
            void runAction(
              () => updateUser.mutateAsync(input),
              MESSAGES.user.toast.updated,
            )
          }
          loading={updateUser.isPending}
          error={
            updateUser.error ? apiErrorMessage(updateUser.error) : undefined
          }
        />
      )}

      {openDialog === 'password' && (
        <UserPasswordResetDialog
          open
          user={user}
          onOpenChange={closeDialog(
            resetPassword.isPending,
            resetPassword.reset,
          )}
          onSubmit={(newPassword) =>
            void runAction(
              () => resetPassword.mutateAsync(newPassword),
              MESSAGES.user.toast.passwordReset,
            )
          }
          loading={resetPassword.isPending}
          error={
            resetPassword.error
              ? apiErrorMessage(resetPassword.error)
              : undefined
          }
        />
      )}

      {openDialog === 'deactivate' && (
        <ConfirmDialog
          open
          title={MESSAGES.user.heading.deactivate}
          description={MESSAGES.user.confirm.deactivate(user.email)}
          confirmLabel={MESSAGES.user.action.deactivate}
          destructive
          onOpenChange={closeDialog(
            deactivateUser.isPending,
            deactivateUser.reset,
          )}
          onConfirm={() =>
            void runAction(
              () => deactivateUser.mutateAsync(),
              MESSAGES.user.toast.deactivated,
            )
          }
          loading={deactivateUser.isPending}
          error={
            deactivateUser.error
              ? apiErrorMessage(deactivateUser.error)
              : undefined
          }
        />
      )}

      {openDialog === 'reactivate' && (
        <ConfirmDialog
          open
          title={MESSAGES.user.heading.reactivate}
          description={MESSAGES.user.confirm.reactivate(user.email)}
          confirmLabel={MESSAGES.user.action.reactivate}
          onOpenChange={closeDialog(
            reactivateUser.isPending,
            reactivateUser.reset,
          )}
          onConfirm={() =>
            void runAction(
              () => reactivateUser.mutateAsync(),
              MESSAGES.user.toast.reactivated,
            )
          }
          loading={reactivateUser.isPending}
          error={
            reactivateUser.error
              ? apiErrorMessage(reactivateUser.error)
              : undefined
          }
        />
      )}

      {openDialog === 'revoke' && (
        <ConfirmDialog
          open
          title={MESSAGES.user.heading.revokeSessions}
          description={MESSAGES.user.confirm.revokeSessions(user.email)}
          confirmLabel={MESSAGES.user.action.revokeSessions}
          destructive
          onOpenChange={closeDialog(
            revokeSessions.isPending,
            revokeSessions.reset,
          )}
          onConfirm={() =>
            void runAction(
              () => revokeSessions.mutateAsync(),
              MESSAGES.user.toast.sessionsRevoked,
            )
          }
          loading={revokeSessions.isPending}
          error={
            revokeSessions.error
              ? apiErrorMessage(revokeSessions.error)
              : undefined
          }
        />
      )}

      {openDialog === 'delete' && (
        <UserDeleteDialog
          open
          user={user}
          impact={deletionImpactQuery.data?.impact}
          impactLoading={deletionImpactQuery.isLoading}
          onOpenChange={closeDialog(deleteUser.isPending, deleteUser.reset)}
          onConfirm={(confirmationEmail) =>
            void runAction(
              () => deleteUser.mutateAsync(confirmationEmail),
              MESSAGES.user.toast.deleted,
              /* 삭제된 사용자의 상세 화면에 남아 있을 수 없다. */
              () => void navigate({ to: '/users', replace: true }),
            )
          }
          loading={deleteUser.isPending}
          error={
            deleteUser.error ? apiErrorMessage(deleteUser.error) : undefined
          }
        />
      )}
    </section>
  )
}

export { UserDetailPage }
