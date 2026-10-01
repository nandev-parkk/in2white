import { useQuery } from '@tanstack/react-query'

import { getSystemStatusRequest } from '@/entities/system'
import { QUERY_KEYS } from '@/shared/api'

/*
 * 자동 갱신은 두지 않는다. 상태 화면을 열어둔 채로 두면 DB·Valkey에 주기적인 점검
 * 쿼리가 계속 간다. 필요할 때 어드민이 직접 다시 점검한다.
 */
export function useSystemStatus() {
  return useQuery({
    queryKey: QUERY_KEYS.systemStatus,
    queryFn: getSystemStatusRequest,
  })
}
