import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'

import type { AdminUser, UpdateUserInput } from '@/entities/user'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'
import { Input } from '@in2white/ui/input'

import {
  updateUserFormSchema,
  type UpdateUserFormValues,
} from '../model/user-form-schema'
import { UserFormField } from './UserFormField'

/*
 * 바뀐 항목만 보낸다. 백엔드는 전달된 필드만 수정하므로 전체를 보내면 건드리지 않은
 * 이메일까지 중복 검사와 감사 로그에 남는다. zod가 입력을 다듬으므로 여기서도 다듬은
 * 값으로 비교한다.
 */
function buildChangedInput(
  values: UpdateUserFormValues,
  user: AdminUser,
): UpdateUserInput {
  const input: UpdateUserInput = {}
  if (values.email.trim() !== user.email) input.email = values.email.trim()
  if (values.name.trim() !== user.name) input.name = values.name.trim()

  return input
}

type UserEditDialogProps = {
  open: boolean
  user: AdminUser
  onOpenChange: (open: boolean) => void
  onSubmit: (input: UpdateUserInput) => void
  loading?: boolean
  error?: string
}

function UserEditDialog({
  open,
  user,
  onOpenChange,
  onSubmit,
  loading = false,
  error,
}: UserEditDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitted },
  } = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserFormSchema),
    defaultValues: { email: user.email, name: user.name },
  })

  /* 대상이 바뀌거나 모달을 닫으면 현재 값으로 되돌린다. */
  useEffect(() => {
    reset({ email: user.email, name: user.name })
  }, [open, user.email, user.name, reset])

  const handleValidSubmit = (values: UpdateUserFormValues) => {
    if (loading) return

    const input = buildChangedInput(values, user)
    if (Object.keys(input).length === 0) {
      /* 공백만 바꾼 경우다. 기준 값으로 되돌려 수정할 내용이 없다고 알린다. */
      reset({ email: user.email, name: user.name }, { keepIsSubmitted: true })
      return
    }

    onSubmit(input)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-[440px]">
        <DialogTitle>{MESSAGES.user.heading.edit}</DialogTitle>
        <form
          onSubmit={handleSubmit(handleValidSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <UserFormField
            id="user-edit-email"
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
            id="user-edit-name"
            label={MESSAGES.user.form.nameLabel}
            error={errors.name?.message}
          >
            {(fieldProps) => (
              <Input {...fieldProps} autoComplete="off" {...register('name')} />
            )}
          </UserFormField>

          {(error ?? (isSubmitted && !isDirty)) && (
            <p className="text-status-danger text-[12px]" role="alert">
              {error ?? MESSAGES.user.form.updateFieldsRequired}
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
              {MESSAGES.common.action.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export { UserEditDialog }
