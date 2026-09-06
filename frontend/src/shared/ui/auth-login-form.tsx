import * as React from 'react'
import { cn } from 'cn'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

type AuthLoginFormProps = React.ComponentProps<'form'> & {
  logo?: React.ReactNode
  loading?: boolean
}

function AuthLoginForm({
  className,
  logo,
  loading,
  ...props
}: AuthLoginFormProps) {
  return (
    <div className="bg-background-subtle flex min-h-svh flex-col items-center justify-center py-16">
      <div className="flex w-(--layout-container-auth-shell-max-width) flex-col items-center gap-8">
        {logo ?? <div className="bg-action-primary size-10 rounded-md" />}
        <form
          data-slot="auth-login-form"
          className={cn('flex w-full flex-col gap-4', className)}
          {...props}
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-label text-foreground-default"
            >
              이메일
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              size="large"
              placeholder="hello@in2white.com"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-label text-foreground-default"
            >
              비밀번호
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              size="large"
              placeholder="••••••••"
              required
            />
          </div>
          <Button
            type="submit"
            size="large"
            className="w-full"
            loading={loading}
          >
            로그인
          </Button>
        </form>
      </div>
    </div>
  )
}

export { AuthLoginForm }
