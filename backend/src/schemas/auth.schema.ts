import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

export const loginSchema = z.object({
  email: z
    .string({ error: ERROR_MESSAGES.EMAIL_REQUIRED })
    .min(1, ERROR_MESSAGES.EMAIL_REQUIRED)
    .email(ERROR_MESSAGES.EMAIL_INVALID_FORMAT),
  password: z
    .string({ error: ERROR_MESSAGES.PASSWORD_REQUIRED })
    .min(1, ERROR_MESSAGES.PASSWORD_REQUIRED),
});

export type LoginInput = z.infer<typeof loginSchema>;
