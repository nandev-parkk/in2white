import { ACCOUNT_MESSAGES } from './account'
import { AUTH_MESSAGES } from './auth'
import { COMMON_MESSAGES } from './common'
import { MEMBER_MESSAGES } from './member'
import { NAV_MESSAGES } from './nav'
import { PROJECT_MESSAGES } from './project'
import { VALIDATION_MESSAGES } from './validation'
import { WHITEBOARD_MESSAGES } from './whiteboard'
import { WORKSPACE_MESSAGES } from './workspace'

/**
 * 사용자에게 보이는 모든 문구의 단일 출처.
 * 도메인 → 용도(toast·error·empty·form·action·a11y) → 이름 순으로 찾는다.
 */
export const MESSAGES = {
  common: COMMON_MESSAGES,
  validation: VALIDATION_MESSAGES,
  account: ACCOUNT_MESSAGES,
  auth: AUTH_MESSAGES,
  member: MEMBER_MESSAGES,
  nav: NAV_MESSAGES,
  project: PROJECT_MESSAGES,
  whiteboard: WHITEBOARD_MESSAGES,
  workspace: WORKSPACE_MESSAGES,
} as const
