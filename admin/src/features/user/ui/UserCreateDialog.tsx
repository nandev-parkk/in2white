import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import type { CreateUserInput } from '@/entities/user'
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
import { PasswordInput } from '@in2white/ui/password-input'

import {
  createUserFormSchema,
  type CreateUserFormValues,
} from '../model/user-form-schema'
import { UserFormField } from './UserFormField'

type UserCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: CreateUserInput) => void
  loading?: boolean
  error?: string
}

function UserCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  error,
}: UserCreateDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: { email: '', name: '', password: '' },
  })

  /* 닫을 때 비운다. 남겨두면 다음 생성에서 이전 사용자의 비밀번호가 그대로 제출된다. */
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
        <DialogTitle>{MESSAGES.user.heading.create}</DialogTitle>
        <DialogDescription>
          {MESSAGES.user.form.createDescription}
        </DialogDescription>
        <form
          onSubmit={handleSubmit((values) => {
            if (!loading) onSubmit(values)
          })}
          className="flex flex-col gap-4"
          noValidate
        >
          <UserFormField
            id="user-create-email"
            label={MESSAGES.user.form.emailLabel}
            error={errors.email?.message}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="email"
                autoComplete="off"
                {...register('email')}
              />
            )}
          </UserFormField>

          <UserFormField
            id="user-create-name"
            label={MESSAGES.user.form.nameLabel}
            error={errors.name?.message}
          >
            {(fieldProps) => (
              <Input {...fieldProps} autoComplete="off" {...register('name')} />
            )}
          </UserFormField>

          <UserFormField
            id="user-create-password"
            label={MESSAGES.user.form.passwordLabel}
            error={errors.password?.message}
          >
            {(fieldProps) => (
              <PasswordInput
                {...fieldProps}
                autoComplete="new-password"
                {...register('password')}
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
              {MESSAGES.user.action.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { UserCreateDialog }
