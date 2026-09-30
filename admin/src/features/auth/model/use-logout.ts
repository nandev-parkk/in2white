import { useMutation } from '@tanstack/react-query'

import { useAdminSessionStore } from '@/entities/admin-session'

import { adminLogoutRequest } from '../api/session'

export function useAdminLogout() {
  return useMutation({
    mutationFn: adminLogoutRequest,
    /*
     * 서버 호출이 실패해도 로컬 세션은 비운다. 화면에 로그인 상태가 남는 편이
     * 토큰을 지우지 못한 것보다 위험하다. 남은 refresh 쿠키는 만료로 정리된다.
     */
    onSettled: () => {
      useAdminSessionStore.getState().clearSession()
    },
  })
}
