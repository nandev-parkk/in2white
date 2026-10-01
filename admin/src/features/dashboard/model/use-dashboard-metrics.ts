import { useQuery } from '@tanstack/react-query'

import { getDashboardMetricsRequest } from '@/entities/dashboard'
import { QUERY_KEYS } from '@/shared/api'

export function useDashboardMetrics() {
  return useQuery({
    queryKey: QUERY_KEYS.dashboardMetrics,
    queryFn: getDashboardMetricsRequest,
  })
}
