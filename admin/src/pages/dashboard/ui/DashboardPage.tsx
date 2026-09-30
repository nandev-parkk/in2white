import { MESSAGES } from '@/shared/constants/messages'

/* 지표 위젯은 단계 5에서 채운다. 지금은 앱 셸과 라우팅을 확인하는 자리다. */
export function DashboardPage() {
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-foreground-strong text-[20px] leading-[1.4] font-bold tracking-[-0.24px]">
        {MESSAGES.nav.menu.dashboard}
      </h1>
    </section>
  )
}
