import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ error: "이메일을 입력해주세요" })
    .min(1, "이메일을 입력해주세요")
    .email("올바른 이메일 형식이 아닙니다"),
  password: z.string({ error: "비밀번호를 입력해주세요" }).min(1, "비밀번호를 입력해주세요"),
});

export type LoginInput = z.infer<typeof loginSchema>;
