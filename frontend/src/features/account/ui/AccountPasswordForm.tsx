import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { ChangeAccountPasswordInput } from '@/entities/account'
import { Button } from '@/shared/ui/button'
import { PasswordInput } from '@/shared/ui/password-input'

import { accountPasswordFormSchema } from '../model/account-form-schema'
import { MESSAGES } from '@/shared/constants/messages'

type AccountPasswordFormValues = z.infer<typeof accountPasswordFormSchema>

type AccountPasswordFormProps = {
  onSubmit: (input: ChangeAccountPasswordInput) => Promise<void> | void
  loading: boolean
  error?: string
}

const fields = [
  {
    name: 'currentPassword',
    label: MESSAGES.account.form.currentPasswordLabel,
    placeholder: MESSAGES.account.form.currentPasswordPlaceholder,
    autoComplete: 'current-password',
  },
  {
    name: 'newPassword',
    label: MESSAGES.account.form.newPasswordLabel,
    placeholder: MESSAGES.account.form.newPasswordPlaceholder,
    autoComplete: 'new-password',
  },
  {
    name: 'confirmPassword',
    label: MESSAGES.account.form.newPasswordConfirmLabel,
    placeholder: MESSAGES.account.form.newPasswordConfirmPlaceholder,
    autoComplete: 'new-password',
  },
] as const

export function AccountPasswordForm({
  onSubmit,
  loading,
  error,
}: AccountPasswordFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountPasswordFormValues>({
    resolver: zodResolver(accountPasswordFormSchema),
  })

  const submit = async ({
    currentPassword,
    newPassword,
  }: AccountPasswordFormValues) => {
    await onSubmit({ currentPassword, newPassword })
  }

  return (
    <form
      className="flex w-full flex-col items-start gap-4"
      noValidate
      onSubmit={handleSubmit(submit)}
    >
      {fields.map(({ name, label, placeholder, autoComplete }) => {
        const fieldError = errors[name]
        const fieldErrorMessage =
          fieldError?.message ??
          (name === 'currentPassword' ? error : undefined)
        const isServerError =
          name === 'currentPassword' && !fieldError && Boolean(error)
        const inputId = `account-${name}`
        const errorId = `${inputId}-error`

        return (
          <div
            key={name}
            className="flex w-full flex-col items-start gap-[6px]"
          >
            <label
              className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
              htmlFor={inputId}
            >
              {label}
            </label>
            <PasswordInput
              id={inputId}
              autoComplete={autoComplete}
              placeholder={placeholder}
              aria-describedby={fieldErrorMessage ? errorId : undefined}
              aria-invalid={!!fieldErrorMessage}
              {...register(name)}
            />
            {fieldErrorMessage && (
              <p
                id={errorId}
                className="text-status-danger text-[12px]"
                role={isServerError ? 'alert' : undefined}
              >
                {fieldErrorMessage}
              </p>
            )}
          </div>
        )
      })}

      <Button className="self-end" type="submit" loading={loading}>
        {MESSAGES.account.action.changePassword}
      </Button>
    </form>
  )
}

export type { AccountPasswordFormProps }
