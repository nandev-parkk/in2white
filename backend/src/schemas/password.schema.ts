import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;

export const passwordSchema = z
  .string({ error: ERROR_MESSAGES.PASSWORD_REQUIRED })
  .min(1, ERROR_MESSAGES.PASSWORD_REQUIRED)
  .min(PASSWORD_MIN_LENGTH, ERROR_MESSAGES.PASSWORD_TOO_SHORT)
  .max(PASSWORD_MAX_LENGTH, ERROR_MESSAGES.PASSWORD_TOO_LONG)
  .regex(/[a-zA-Z]/, ERROR_MESSAGES.PASSWORD_MISSING_LETTER)
  .regex(/[0-9]/, ERROR_MESSAGES.PASSWORD_MISSING_NUMBER)
  .regex(/[^a-zA-Z0-9]/, ERROR_MESSAGES.PASSWORD_MISSING_SPECIAL_CHAR);

export const loginPasswordSchema = z
  .string({ error: ERROR_MESSAGES.PASSWORD_REQUIRED })
  .min(1, ERROR_MESSAGES.PASSWORD_REQUIRED)
  .refine((password) => passwordSchema.safeParse(password).success, {
    message: ERROR_MESSAGES.PASSWORD_INVALID,
  });
