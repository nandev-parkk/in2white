import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { Button } from '@in2white/ui/button'
import { Input } from '@in2white/ui/input'
import { PasswordInput } from '@in2white/ui/password-input'
import { loginPasswordSchema } from '@/shared/validation/password-schema'
import { toast } from '@in2white/ui/toast'

import { useAdminLogin } from '../model/use-login'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, MESSAGES.validation.emailRequired)
    .email(MESSAGES.validation.emailInvalidFormat),
  password: loginPasswordSchema,
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const navigate = useNavigate()
  const login = useAdminLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormValues) => {
    try {
      await login.mutateAsync(values)
      navigate({ to: '/', replace: true })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full flex-col items-start gap-4"
      noValidate
    >
      <div className="flex w-full flex-col items-start gap-1">
        <label
          htmlFor="admin-login-email"
          className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
        >
          {MESSAGES.auth.form.emailLabel}
        </label>
        <Input
          id="admin-login-email"
          type="email"
          size="large"
          placeholder="admin@in2white.team"
          aria-invalid={!!errors.email}
          aria-describedby={
            errors.email ? 'admin-login-email-error' : undefined
          }
          autoComplete="username"
          {...register('email')}
        />
        {errors.email && (
          <p
            id="admin-login-email-error"
            className="text-status-danger text-[12px]"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex w-full flex-col items-start gap-1">
        <label
          htmlFor="admin-login-password"
          className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
        >
          {MESSAGES.auth.form.passwordLabel}
        </label>
        <PasswordInput
          id="admin-login-password"
          size="large"
          placeholder="••••••••"
          aria-invalid={!!errors.password}
          aria-describedby={
            errors.password ? 'admin-login-password-error' : undefined
          }
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && (
          <p
            id="admin-login-password-error"
            className="text-status-danger text-[12px]"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="large"
        className="w-full"
        loading={login.isPending}
      >
        {MESSAGES.auth.action.login}
      </Button>
    </form>
  )
}
