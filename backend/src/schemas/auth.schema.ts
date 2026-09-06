import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().min(1, "email is required").email("invalid email"),
  password: z.string().min(1, "password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;
