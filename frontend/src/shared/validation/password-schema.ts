import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 32

export const passwordSchema = z
  .string()
  .min(1, MESSAGES.PASSWORD_REQUIRED)
  .min(PASSWORD_MIN_LENGTH, MESSAGES.PASSWORD_TOO_SHORT)
  .max(PASSWORD_MAX_LENGTH, MESSAGES.PASSWORD_TOO_LONG)
  .regex(/[a-zA-Z]/, MESSAGES.PASSWORD_MISSING_LETTER)
  .regex(/[0-9]/, MESSAGES.PASSWORD_MISSING_NUMBER)
  .regex(/[^a-zA-Z0-9]/, MESSAGES.PASSWORD_MISSING_SPECIAL_CHAR)

export const loginPasswordSchema = z
  .string()
  .min(1, MESSAGES.PASSWORD_REQUIRED)
  .refine((password) => passwordSchema.safeParse(password).success, {
    message: MESSAGES.PASSWORD_INVALID,
  })
