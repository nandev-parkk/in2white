import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import {
  listWorkspacesRequest,
  selectDefaultWorkspace,
} from '@/entities/workspace'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import { Input } from '@in2white/ui/input'
import { PasswordInput } from '@in2white/ui/password-input'
import { loginPasswordSchema } from '@/shared/validation/password-schema'
import { toast } from '@in2white/ui/toast'

import { useLogin } from '../model/use-login'

const loginSchema = z.object({
  email: z
    .string()
    .min(1, MESSAGES.validation.emailRequired)
    .email(MESSAGES.validation.emailInvalidFormat),
  password: loginPasswordSchema,
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

  return MESSAGES.common.error.network
}

export function LoginForm() {
  const navigate = useNavigate()
  const login = useLogin()
  const [isResolvingWorkspace, setIsResolvingWorkspace] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (values: LoginFormValues) => {
    setIsResolvingWorkspace(true)

    try {
      const { accessToken } = await login.mutateAsync(values)
      let workspaces

      try {
        workspaces = await listWorkspacesRequest(accessToken)
      } catch {
        toast.error(MESSAGES.workspace.error.redirectFailed)
        return
      }

      const workspace = selectDefaultWorkspace(workspaces)
      if (!workspace) {
        toast.error(MESSAGES.workspace.error.notAvailable)
        return
      }

      navigate({
        to: '/workspaces/$workspaceId/projects',
        params: { workspaceId: workspace.id },
        replace: true,
      })
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsResolvingWorkspace(false)
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
          htmlFor="login-email"
          className="text-foreground-default text-[14px] leading-[1.429] font-semibold tracking-[0.0145em]"
        >
          {MESSAGES.auth.form.emailLabel}
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
          {MESSAGES.auth.form.passwordLabel}
        </label>
        <PasswordInput
          id="login-password"
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
        loading={login.isPending || isResolvingWorkspace}
      >
        {MESSAGES.auth.action.login}
      </Button>
    </form>
  )
}
