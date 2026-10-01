import { AUTH_MESSAGES } from './auth'
import { COMMON_MESSAGES } from '@in2white/ui/constants/common-messages'
import { NAV_MESSAGES } from './nav'
import { USER_MESSAGES } from './user'
import { VALIDATION_MESSAGES } from './validation'

/**
 * 어드민 콘솔에서 사용자에게 보이는 모든 문구의 단일 출처.
 * 제품 프런트엔드와 문구를 공유하지 않는다 — 대상 사용자가 다르다.
 */
export const MESSAGES = {
  common: COMMON_MESSAGES,
  validation: VALIDATION_MESSAGES,
  auth: AUTH_MESSAGES,
  nav: NAV_MESSAGES,
  user: USER_MESSAGES,
} as const
