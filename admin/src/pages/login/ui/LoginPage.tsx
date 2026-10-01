import { LoginForm } from '@/features/auth'
import { MESSAGES } from '@/shared/constants/messages'

export function LoginPage() {
  return (
    <main className="bg-background-default flex min-h-svh flex-col items-center justify-center">
      <div className="flex w-(--layout-container-auth-shell-max-width) flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <p className="text-foreground-strong text-[20px] leading-[1.4] font-bold tracking-[-0.24px]">
            {MESSAGES.auth.intro.title}
          </p>
          <p className="text-foreground-secondary text-[14px] leading-[1.429] font-medium tracking-[0.0145em]">
            {MESSAGES.auth.intro.tagline}
          </p>
        </div>

        <div className="bg-border-subtle h-px w-full" />

        <LoginForm />

        <p className="text-foreground-tertiary text-center text-[12px] leading-[1.334] tracking-[0.0252em]">
          {MESSAGES.auth.intro.restricted}
        </p>
      </div>
    </main>
  )
}
