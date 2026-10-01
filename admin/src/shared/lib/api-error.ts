import { isAxiosError } from 'axios'

import { MESSAGES } from '@/shared/constants/messages'

type ApiErrorBody = {
  error?: { message?: string; code?: string }
}

/*
 * 백엔드 에러 핸들러(backend/src/middlewares/error-handler.middleware.ts)는 모든 에러를
 * `{ error: { message, code } }`로 응답한다 — 최상위 `message`가 아니다.
 */
export function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error) && error.response) {
    const data = error.response.data as ApiErrorBody | undefined
    if (data?.error?.message) return data.error.message
  }

  return MESSAGES.common.error.network
}

export function apiErrorCode(error: unknown): string | undefined {
  return isAxiosError(error)
    ? (error.response?.data as ApiErrorBody | undefined)?.error?.code
    : undefined
}
