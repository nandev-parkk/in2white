import { z } from 'zod'

import { MESSAGES } from '@/shared/constants/messages'
import { passwordSchema } from '@/shared/validation/password-schema'

const emailSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.validation.emailRequired)
  .email(MESSAGES.validation.emailInvalidFormat)

const nameSchema = z
  .string()
  .trim()
  .min(1, MESSAGES.validation.nameRequired)
  .max(255, MESSAGES.validation.nameTooLong)

export const createUserFormSchema = z.object({
  email: emailSchema,
  name: nameSchema,
  password: passwordSchema,
})

export const updateUserFormSchema = z.object({
  email: emailSchema,
  name: nameSchema,
})

export const resetUserPasswordFormSchema = z.object({
  newPassword: passwordSchema,
})

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>
export type UpdateUserFormValues = z.infer<typeof updateUserFormSchema>
export type ResetUserPasswordFormValues = z.infer<
  typeof resetUserPasswordFormSchema
>
