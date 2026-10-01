import { axiosInstance } from '@/shared/api'

/*
 * 대시보드는 읽기만 한다 — 백엔드가 집계한 숫자를 그대로 받아 쓴다. 화면에서 다시
 * 더하거나 비율을 계산하지 않는다. 같은 숫자를 두 곳에서 만들면 어긋난다.
 */

export type AdminDashboardTotals = {
  users: { total: number; deactivated: number }
  workspaces: { total: number }
  projects: { total: number; deleted: number }
  whiteboardDocuments: { total: number; deleted: number }
}

export type AdminDashboardTrendDay = {
  /** UTC 기준 `YYYY-MM-DD`. */
  date: string
  users: number
  projects: number
  whiteboardDocuments: number
}

export type AdminDashboardMetrics = {
  totals: AdminDashboardTotals
  /** 최근 7일. 생성이 없던 날도 0으로 채워져 온다. */
  trend: AdminDashboardTrendDay[]
}

export async function getDashboardMetricsRequest(): Promise<AdminDashboardMetrics> {
  const { data } =
    await axiosInstance.get<AdminDashboardMetrics>('/dashboard/metrics')

  return data
}
