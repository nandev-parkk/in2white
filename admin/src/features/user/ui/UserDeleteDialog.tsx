import { useState } from 'react'

import type { AdminUser, UserDeletionImpact } from '@/entities/user'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'
import { Input } from '@in2white/ui/input'

import { UserFormField } from './UserFormField'

type UserDeleteDialogProps = {
  open: boolean
  user: AdminUser
  onOpenChange: (open: boolean) => void
  onConfirm: (confirmationEmail: string) => void
  impact?: UserDeletionImpact['impact']
  impactLoading?: boolean
  loading?: boolean
  error?: string
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function UserDeleteDialog({
  open,
  user,
  onOpenChange,
  onConfirm,
  impact,
  impactLoading = false,
  loading = false,
  error,
}: UserDeleteDialogProps) {
  /*
   * 입력한 확인용 이메일은 모달이 닫힐 때 컴포넌트와 함께 사라진다 — 호출부는 열려
   * 있는 동안만 이 모달을 마운트한다. 닫힌 상태로 남겨두면 다음 대상에 이전 입력이
   * 남으므로, 그렇게 쓰지 않는다.
   */
  const [confirmation, setConfirmation] = useState('')

  /*
   * 입력한 이메일이 대상과 정확히 같을 때만 삭제를 허용한다. 목록에서 행을 잘못 고른
   * 삭제를 막는 마지막 장치이고, 백엔드도 같은 값을 다시 대조한다.
   */
  const confirmed = normalizeEmail(confirmation) === user.email.toLowerCase()

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-[480px]">
        <DialogTitle>{MESSAGES.user.heading.delete}</DialogTitle>
        <DialogDescription>
          {MESSAGES.user.confirm.delete(user.email)}
        </DialogDescription>

        <section className="flex flex-col gap-2">
          <p className="text-foreground-default text-[14px] font-semibold">
            {MESSAGES.user.heading.deletionImpact}
          </p>
          {impactLoading || !impact ? (
            <p className="text-foreground-secondary text-[14px]">
              {MESSAGES.user.impact.loading}
            </p>
          ) : (
            <ul className="text-foreground-secondary flex flex-col gap-1 text-[14px]">
              <li>
                {MESSAGES.user.impact.ownedWorkspace(
                  impact.ownedWorkspaceCount,
                )}
              </li>
              <li>
                {MESSAGES.user.impact.otherWorkspaceMembership(
                  impact.otherWorkspaceMembershipCount,
                )}
              </li>
              <li>{MESSAGES.user.impact.project(impact.projectCount)}</li>
              <li>
                {MESSAGES.user.impact.whiteboardDocument(
                  impact.whiteboardDocumentCount,
                )}
              </li>
            </ul>
          )}
        </section>

        <UserFormField
          id="user-delete-confirmation"
          label={MESSAGES.user.form.confirmEmailLabel}
          hint={MESSAGES.user.form.confirmEmailHint}
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              autoComplete="off"
              placeholder={user.email}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          )}
        </UserFormField>

        {error && (
          <p className="text-status-danger text-[12px]" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="tertiary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {MESSAGES.common.action.cancel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed}
            loading={loading}
            onClick={() => onConfirm(normalizeEmail(confirmation))}
          >
            {MESSAGES.user.action.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { UserDeleteDialog }
