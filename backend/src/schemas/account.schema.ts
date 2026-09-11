import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { passwordSchema } from "@/schemas/password.schema";

const accountNameSchema = z
  .string({ error: ERROR_MESSAGES.ACCOUNT_NAME_REQUIRED })
  .trim()
  .min(1, ERROR_MESSAGES.ACCOUNT_NAME_REQUIRED)
  .max(255, ERROR_MESSAGES.ACCOUNT_NAME_TOO_LONG);

const currentPasswordSchema = z
  .string({ error: ERROR_MESSAGES.CURRENT_PASSWORD_REQUIRED })
  .min(1, ERROR_MESSAGES.CURRENT_PASSWORD_REQUIRED);

export const updateAccountSchema = z.object({ name: accountNameSchema });

export const changePasswordSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: passwordSchema,
});

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
