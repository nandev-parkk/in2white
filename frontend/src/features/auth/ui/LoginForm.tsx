import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { toast } from '@/shared/ui/toast'

import { useLogin } from '../model/use-login'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, MESSAGES.EMAIL_REQUIRED)
    .email(MESSAGES.EMAIL_INVALID_FORMAT),
  password: z.string().min(1, MESSAGES.PASSWORD_REQUIRED),
})

type LoginFormValues = z.infer<typeof loginSchema>

function getErrorMessage(error: unknown): string {
  // 백엔드 에러 핸들러(backend/src/middlewares/error-handler.middleware.ts)는
  // 모든 에러를 { error: { message, code } } 형태로 응답한다 — 최상위 message가 아니다.
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as
      { error?: { message?: string } } | undefined
    if (data?.error?.message) {
      return data.error.message
    }
  }

  return MESSAGES.NETWORK_ERROR
}

export function LoginForm() {
  const navigate = useNavigate()
  const login = useLogin()
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = (values: LoginFormValues) => {
    login.mutate(values, {
      onSuccess: () => {
        navigate({ to: '/' })
      },
      onError: (error) => {
        toast.error(getErrorMessage(error))
      },
    })
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex w-full flex-col items-start gap-4"
      noValidate
    >
      <div className="flex w-full flex-col items-start gap-1">
        <label
          htmlFor="login-email"
          className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
        >
          이메일
        </label>
        <Input
          id="login-email"
          type="email"
          size="large"
          placeholder="you@in2white.team"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          autoComplete="username"
          {...register('email')}
        />
        {errors.email && (
          <p id="login-email-error" className="text-status-danger text-[12px]">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex w-full flex-col items-start gap-1">
        <label
          htmlFor="login-password"
          className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
        >
          비밀번호
        </label>
        <Input
          id="login-password"
          type="password"
          size="large"
          placeholder="••••••••"
          aria-invalid={!!errors.password}
          aria-describedby={
            errors.password ? 'login-password-error' : undefined
          }
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && (
          <p
            id="login-password-error"
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
        로그인
      </Button>
    </form>
  )
}
