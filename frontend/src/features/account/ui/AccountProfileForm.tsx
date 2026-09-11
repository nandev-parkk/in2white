import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import type { AccountUser, UpdateAccountInput } from '@/entities/account'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

import { accountNameSchema } from '../model/account-form-schema'

type AccountProfileFormValues = z.infer<typeof accountNameSchema>

type AccountProfileFormProps = {
  user: AccountUser
  onSubmit: (input: UpdateAccountInput) => Promise<void> | void
  loading: boolean
  error?: string
}

export function AccountProfileForm({
  user,
  onSubmit,
  loading,
  error,
}: AccountProfileFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AccountProfileFormValues>({
    resolver: zodResolver(accountNameSchema),
    defaultValues: { name: user.name },
  })

  useEffect(() => {
    if (!isDirty) reset({ name: user.name })
  }, [isDirty, reset, user.name])

  const submit = async ({ name }: AccountProfileFormValues) => {
    await onSubmit({ name })
  }

  return (
    <form
      className="flex w-full flex-col items-start gap-4"
      noValidate
      onSubmit={handleSubmit(submit)}
    >
      {error && (
        <p className="text-status-danger text-[12px]" role="alert">
          {error}
        </p>
      )}

      <div className="flex w-full flex-col items-start gap-[6px]">
        <label
          className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
          htmlFor="account-id"
        >
          아이디
        </label>
        <Input
          id="account-id"
          aria-describedby={undefined}
          aria-invalid={false}
          disabled
          value={user.email}
        />
      </div>

      <div className="flex w-full flex-col items-start gap-[6px]">
        <label
          className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
          htmlFor="account-name"
        >
          이름
        </label>
        <Input
          id="account-name"
          aria-describedby={errors.name ? 'account-name-error' : undefined}
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && (
          <p id="account-name-error" className="text-status-danger text-[12px]">
            {errors.name.message}
          </p>
        )}
      </div>

      <Button className="self-end" type="submit" loading={loading}>
        저장
      </Button>
    </form>
  )
}

export type { AccountProfileFormProps }
