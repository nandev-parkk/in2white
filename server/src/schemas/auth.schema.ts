import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { loginPasswordSchema } from "@/schemas/password.schema";

export const loginSchema = z.object({
  email: z
    .string({ error: ERROR_MESSAGES.EMAIL_REQUIRED })
    .min(1, ERROR_MESSAGES.EMAIL_REQUIRED)
    .email(ERROR_MESSAGES.EMAIL_INVALID_FORMAT),
  password: loginPasswordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
