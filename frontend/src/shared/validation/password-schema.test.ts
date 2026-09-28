import { MESSAGES } from '@/shared/constants/messages'
import { loginPasswordSchema, passwordSchema } from './password-schema'

describe('passwordSchema', () => {
  it('accepts a password that satisfies every policy rule', () => {
    expect(passwordSchema.safeParse('Password123!').success).toBe(true)
  })

  it.each([
    ['short', 'Se1!', MESSAGES.validation.passwordTooShort],
    ['too long', `${'a'.repeat(31)}A1!`, MESSAGES.validation.passwordTooLong],
    [
      'missing a letter',
      '12345678!',
      MESSAGES.validation.passwordMissingLetter,
    ],
    [
      'missing a number',
      'Password!',
      MESSAGES.validation.passwordMissingNumber,
    ],
    [
      'missing a special character',
      'Password123',
      MESSAGES.validation.passwordMissingSpecialChar,
    ],
  ])('rejects a password that is %s', (_reason, password, message) => {
    const result = passwordSchema.safeParse(password)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(message)
    }
  })

  it('shows the required message for an empty login password', () => {
    const result = loginPasswordSchema.safeParse('')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        MESSAGES.validation.passwordRequired,
      )
    }
  })

  it.each([
    'Se1!',
    `${'a'.repeat(31)}A1!`,
    '12345678!',
    'Password!',
    'Password123',
  ])(
    'rejects non-empty invalid login passwords without exposing the policy rule: %s',
    (password) => {
      const result = loginPasswordSchema.safeParse(password)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          MESSAGES.validation.passwordInvalid,
        )
      }
    },
  )
})
