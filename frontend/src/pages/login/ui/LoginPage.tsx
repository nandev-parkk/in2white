import { LoginForm } from '@/features/auth'

export function LoginPage() {
  return (
    <main className="bg-background-default flex min-h-svh flex-col items-center justify-center">
      <div className="flex w-(--layout-container-auth-shell-max-width) flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <img src="/logo-mark.png" alt="" className="size-7 rounded-sm" />
            <p className="text-foreground-strong text-[20px] leading-[1.4] font-bold tracking-[-0.24px]">
              in2white
            </p>
          </div>
          <p className="text-foreground-secondary text-[14px] leading-[1.429] font-medium tracking-[0.0145em]">
            팀의 화이트보드를 함께 그려요.
          </p>
        </div>

        <div className="bg-border-subtle h-px w-full" />

        <LoginForm />

        <p className="text-foreground-tertiary text-center text-[12px] leading-[1.334] tracking-[0.0252em]">
          <span>계정은 관리자가 미리 만들어 드려요.</span>
          <br />
          <span>로그인이 안 되면 워크스페이스 소유자에게 문의해 주세요.</span>
        </p>
      </div>
    </main>
  )
}
