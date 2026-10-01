import type { PropsWithChildren } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { FolderKanban, LayoutDashboard, Users } from 'lucide-react'

import { useAdminSessionStore } from '@/entities/admin-session'
import { useAdminLogout } from '@/features/auth'
import { env } from '@/shared/config/env'
import { MESSAGES } from '@/shared/constants/messages'
import { Badge } from '@in2white/ui/badge'
import { Button } from '@in2white/ui/button'

const MENU_ITEMS = [
  { to: '/', label: MESSAGES.nav.menu.dashboard, icon: LayoutDashboard },
  { to: '/users', label: MESSAGES.nav.menu.users, icon: Users },
  {
    to: '/workspaces',
    label: MESSAGES.nav.menu.workspaces,
    icon: FolderKanban,
  },
] as const

export function AdminAppShell({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const admin = useAdminSessionStore((state) => state.admin)
  const logout = useAdminLogout()

  /*
   * 서버 호출의 성패와 무관하게 로그인 화면으로 보낸다. `useAdminLogout`이 로컬
   * 세션을 이미 비웠으므로, 남아 있으면 인증이 필요한 화면에 빈 상태로 머문다.
   */
  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate({ to: '/login', replace: true })
      },
    })
  }

  return (
    <div className="bg-background-default flex min-h-svh">
      <nav
        aria-label={MESSAGES.nav.a11y.sidebar}
        className="border-border-subtle flex w-60 shrink-0 flex-col gap-4 border-r p-4"
      >
        <p className="text-foreground-strong text-[16px] leading-[1.4] font-bold tracking-[-0.24px]">
          {MESSAGES.auth.intro.title}
        </p>
        <ul className="flex flex-col gap-1">
          {MENU_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className="text-foreground-secondary hover:bg-background-subtle flex items-center gap-2 rounded-md px-2 py-1.5 text-[14px] leading-[1.429] font-medium"
                /* 대시보드는 모든 경로의 접두사다. 정확히 일치할 때만 활성으로 본다. */
                activeOptions={{ exact: to === '/' }}
                activeProps={{ className: 'text-foreground-strong' }}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border-subtle flex items-center justify-between gap-2 border-b px-6 py-3">
          <Badge
            aria-label={MESSAGES.nav.a11y.environment(env.environmentLabel)}
          >
            {env.environmentLabel}
          </Badge>
          <div className="flex items-center gap-3">
            {admin && (
              <span className="text-foreground-secondary text-[14px] leading-[1.429]">
                {admin.email}
              </span>
            )}
            <Button
              variant="secondary"
              loading={logout.isPending}
              onClick={handleLogout}
            >
              {MESSAGES.nav.action.logout}
            </Button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
