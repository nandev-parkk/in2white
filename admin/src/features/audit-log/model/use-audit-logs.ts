import { useQuery } from '@tanstack/react-query'

import {
  listAuditLogsRequest,
  type AuditLogListParams,
} from '@/entities/audit-log'
import { QUERY_KEYS } from '@/shared/api'

export function useAuditLogs(params: AuditLogListParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.auditLogs, params],
    queryFn: () => listAuditLogsRequest(params),
    /* 필터·페이지 전환에서 표가 비었다 다시 차는 깜빡임을 막는다. */
    placeholderData: (previousData) => previousData,
  })
}
