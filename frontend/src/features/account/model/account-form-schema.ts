import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'
import { passwordSchema } from '@/shared/validation/password-schema'

export const accountNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, MESSAGES.account.form.nameRequired)
    .max(255, MESSAGES.account.form.nameTooLong),
})

export const accountPasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, MESSAGES.validation.passwordRequired),
    newPassword: passwordSchema,
    confirmPassword: z
      .string()
      .min(1, MESSAGES.validation.passwordConfirmRequired),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: MESSAGES.validation.passwordConfirmMismatch,
  })
