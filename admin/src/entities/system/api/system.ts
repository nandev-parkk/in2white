import { axiosInstance } from '@/shared/api'

/*
 * 의존성이 죽어도 응답은 200이다 — 상태 화면이 500으로 끊기면 무엇이 죽었는지 볼 수
 * 없다. 그래서 요청 실패는 "점검 실패"가 아니라 어드민 API 자체의 장애를 뜻한다.
 */

export type DependencyHealth = 'up' | 'down'

export type AdminDependencyStatus = {
  status: DependencyHealth
  latencyMs: number
}

export type AdminRealtimeStats = {
  documentCount: number
  participantCount: number
  socketCount: number
}

export type AdminSystemStatus = {
  checkedAt: string
  database: AdminDependencyStatus
  cache: AdminDependencyStatus
  /** 소켓 서버 없이 HTTP 앱만 띄운 구성에서는 `null`이다. */
  realtime: AdminRealtimeStats | null
}

export async function getSystemStatusRequest(): Promise<AdminSystemStatus> {
  const { data } = await axiosInstance.get<AdminSystemStatus>('/system/status')

  return data
}
