import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'
import { passwordSchema } from '@/shared/validation/password-schema'

export const accountNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, MESSAGES.ACCOUNT_NAME_REQUIRED)
    .max(255, MESSAGES.ACCOUNT_NAME_TOO_LONG),
})

export const accountPasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, MESSAGES.PASSWORD_REQUIRED),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, MESSAGES.PASSWORD_CONFIRM_REQUIRED),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: MESSAGES.PASSWORD_CONFIRM_MISMATCH,
  })
