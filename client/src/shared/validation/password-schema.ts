import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 32

export const passwordSchema = z
  .string()
  .min(1, MESSAGES.validation.passwordRequired)
  .min(PASSWORD_MIN_LENGTH, MESSAGES.validation.passwordTooShort)
  .max(PASSWORD_MAX_LENGTH, MESSAGES.validation.passwordTooLong)
  .regex(/[a-zA-Z]/, MESSAGES.validation.passwordMissingLetter)
  .regex(/[0-9]/, MESSAGES.validation.passwordMissingNumber)
  .regex(/[^a-zA-Z0-9]/, MESSAGES.validation.passwordMissingSpecialChar)

export const loginPasswordSchema = z
  .string()
  .min(1, MESSAGES.validation.passwordRequired)
  .refine((password) => passwordSchema.safeParse(password).success, {
    message: MESSAGES.validation.passwordInvalid,
  })
