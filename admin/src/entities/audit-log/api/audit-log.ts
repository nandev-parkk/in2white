import { axiosInstance } from '@/shared/api'
import type { Pagination } from '@/shared/types/pagination'

/*
 * 감사 로그는 읽기 전용이다. 어드민이 자기 기록을 지우거나 고칠 수 있으면 감사의
 * 의미가 없어지므로, 백엔드에도 수정·삭제 엔드포인트가 없다.
 */

export type AuditTargetType =
  'user' | 'workspace' | 'project' | 'whiteboard_document' | 'admin'

export type AdminAuditLogAdmin = {
  id: string
  email: string
  name: string
}

export type AdminAuditLog = {
  id: string
  /** 예: `user.update`, `workspace.delete` */
  action: string
  /** DB에는 문자열로 들어간다 — 프런트엔드가 모르는 값이 올 수 있다. */
  targetType: string
  targetId: string | null
  summary: string
  /** 변경 전/후 값. 비밀번호 관련 키는 백엔드가 기록 전에 걸러낸다. */
  metadata: Record<string, unknown>
  ip: string | null
  userAgent: string | null
  createdAt: string
  admin: AdminAuditLogAdmin
}

export type AuditLogListParams = {
  page: number
  limit: number
  adminId?: string
  action?: string
  targetType?: AuditTargetType
  /** 날짜 입력값 그대로의 `YYYY-MM-DD`. */
  from?: string
  to?: string
}

export type ListAuditLogsResponse = {
  auditLogs: AdminAuditLog[]
  pagination: Pagination
}

/*
 * 어드민은 날짜를 고르지만 백엔드는 시각으로 비교한다. 종료일을 그대로 보내면 그날
 * 0시 이후의 기록이 모두 빠져 "오늘까지" 조회가 오늘을 빼먹는다.
 */
function startOfDay(date: string): string {
  return new Date(`${date}T00:00:00.000`).toISOString()
}

function endOfDay(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString()
}

export async function listAuditLogsRequest(
  params: AuditLogListParams,
): Promise<ListAuditLogsResponse> {
  const action = params.action?.trim()
  const { data } = await axiosInstance.get<ListAuditLogsResponse>(
    '/audit-logs',
    {
      params: {
        page: params.page,
        limit: params.limit,
        /* 빈 필터를 보내면 백엔드가 400으로 막는다. 고르지 않은 조건은 아예 뺀다. */
        ...(params.adminId ? { adminId: params.adminId } : {}),
        ...(action ? { action } : {}),
        ...(params.targetType ? { targetType: params.targetType } : {}),
        ...(params.from ? { from: startOfDay(params.from) } : {}),
        ...(params.to ? { to: endOfDay(params.to) } : {}),
      },
    },
  )

  return data
}
