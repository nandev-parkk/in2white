import { describe, expect, it } from 'vitest'

import { MESSAGES } from '@/shared/constants/messages'

import {
  accountNameSchema,
  accountPasswordFormSchema,
} from './account-form-schema'

describe('account form schema', () => {
  it('이름을 trim하고 공백·256자 이상을 거부한다', () => {
    expect(accountNameSchema.parse({ name: '  새 이름  ' })).toEqual({
      name: '새 이름',
    })
    expect(accountNameSchema.safeParse({ name: '   ' }).success).toBe(false)
    expect(accountNameSchema.safeParse({ name: 'a'.repeat(256) }).success).toBe(
      false,
    )
  })

  it('새 비밀번호 확인이 다르면 confirmPassword에 오류를 연결한다', () => {
    const result = accountPasswordFormSchema.safeParse({
      currentPassword: 'Old123!',
      newPassword: 'New12345!',
      confirmPassword: 'Different123!',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
      expect(result.error.issues[0]?.message).toBe(
        MESSAGES.PASSWORD_CONFIRM_MISMATCH,
      )
    }
  })
})
