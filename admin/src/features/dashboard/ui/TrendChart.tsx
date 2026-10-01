import type { AdminDashboardTrendDay } from '@/entities/dashboard'
import { MESSAGES } from '@/shared/constants/messages'

/* 색은 공유 토큰에서 가져온다 — 어드민 전용 색을 새로 만들지 않는다. */
const SERIES = [
  {
    key: 'users',
    label: MESSAGES.dashboard.trend.column.users,
    barClassName: 'bg-action-primary',
  },
  {
    key: 'projects',
    label: MESSAGES.dashboard.trend.column.projects,
    barClassName: 'bg-status-info',
  },
  {
    key: 'whiteboardDocuments',
    label: MESSAGES.dashboard.trend.column.whiteboardDocuments,
    barClassName: 'bg-status-success',
  },
] as const

/*
 * 백엔드가 UTC 기준 `YYYY-MM-DD`로 준다. `Date`로 바꾸면 보는 사람의 타임존에 따라
 * 하루 밀리므로 문자열을 그대로 자른다.
 */
function formatDayLabel(date: string): string {
  const [, month, day] = date.split('-')

  return month && day ? `${month}.${day}` : date
}

type TrendChartProps = {
  trend: AdminDashboardTrendDay[]
}

function TrendChart({ trend }: TrendChartProps) {
  /* 모두 0인 날이 이어지면 0으로 나누게 된다. 최소 1로 둬 막대를 눌러 둔다. */
  const maxCount = Math.max(
    1,
    ...trend.flatMap((day) => SERIES.map((series) => day[series.key])),
  )
  const isEmpty = trend.every((day) =>
    SERIES.every((series) => day[series.key] === 0),
  )

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground-strong text-[16px] leading-[1.4] font-bold">
          {MESSAGES.dashboard.heading.trend}
        </h2>
        <ul className="flex flex-wrap items-center gap-3">
          {SERIES.map((series) => (
            <li
              key={series.key}
              className="text-foreground-secondary flex items-center gap-1.5 text-[12px] leading-[1.4]"
            >
              <span
                aria-hidden
                className={`size-2 rounded-full ${series.barClassName}`}
              />
              {series.label}
            </li>
          ))}
        </ul>
      </div>

      {/*
       * 막대는 눈으로만 읽을 수 있다. 같은 숫자를 아래 표로 함께 제공한다.
       * 일별 칸은 늘어나서 높이를 받아야 한다. `items-end`로 두면 칸 높이가 내용으로
       * 정해지고, 그 안의 `h-full`이 0을 가리켜 막대가 통째로 사라진다.
       */}
      <div aria-hidden className="flex h-40 gap-2">
        {trend.map((day) => (
          <div
            key={day.date}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-1">
              {SERIES.map((series) => (
                <div
                  key={series.key}
                  className="flex h-full w-2 items-end justify-center"
                >
                  <div
                    className={`w-full rounded-t-sm ${series.barClassName}`}
                    style={{ height: `${(day[series.key] / maxCount) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <span className="text-foreground-tertiary text-[12px] leading-[1.4]">
              {formatDayLabel(day.date)}
            </span>
          </div>
        ))}
      </div>

      {isEmpty && (
        <p className="text-foreground-secondary text-[14px] leading-[1.429]">
          {MESSAGES.dashboard.trend.empty}
        </p>
      )}

      <table className="sr-only" aria-label={MESSAGES.dashboard.heading.trend}>
        <thead>
          <tr>
            <th scope="col">{MESSAGES.dashboard.trend.column.date}</th>
            {SERIES.map((series) => (
              <th key={series.key} scope="col">
                {series.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trend.map((day) => (
            <tr key={day.date}>
              <td>{formatDayLabel(day.date)}</td>
              {SERIES.map((series) => (
                <td key={series.key}>{day[series.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export { TrendChart }
