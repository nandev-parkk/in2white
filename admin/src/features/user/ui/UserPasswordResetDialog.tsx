import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import type { AdminUser } from '@/entities/user'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'
import { PasswordInput } from '@in2white/ui/password-input'

import {
  resetUserPasswordFormSchema,
  type ResetUserPasswordFormValues,
} from '../model/user-form-schema'
import { UserFormField } from './UserFormField'

type UserPasswordResetDialogProps = {
  open: boolean
  user: AdminUser
  onOpenChange: (open: boolean) => void
  onSubmit: (newPassword: string) => void
  loading?: boolean
  error?: string
}

function UserPasswordResetDialog({
  open,
  user,
  onOpenChange,
  onSubmit,
  loading = false,
  error,
}: UserPasswordResetDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResetUserPasswordFormValues>({
    resolver: zodResolver(resetUserPasswordFormSchema),
    defaultValues: { newPassword: '' },
  })

  /* 평문 비밀번호를 폼에 남겨두지 않는다. */
  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-[440px]">
        <DialogTitle>{MESSAGES.user.heading.resetPassword}</DialogTitle>
        <DialogDescription>
          {MESSAGES.user.confirm.resetPassword(user.email)}
        </DialogDescription>
        <form
          onSubmit={handleSubmit((values) => {
            if (!loading) onSubmit(values.newPassword)
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          <UserFormField
            id="user-reset-password"
            label={MESSAGES.user.form.newPasswordLabel}
            error={errors.newPassword?.message}
          >
            {(fieldProps) => (
              <PasswordInput
                {...fieldProps}
                autoComplete="new-password"
                {...register('newPassword')}
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
            <Button type="submit" loading={loading}>
              {MESSAGES.user.action.resetPassword}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { UserPasswordResetDialog }
