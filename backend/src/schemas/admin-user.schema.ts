import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { accountNameSchema } from "@/schemas/account.schema";
import { listQuerySchema } from "@/schemas/list-query.schema";
import { passwordSchema } from "@/schemas/password.schema";

/*
 * 어드민이 입력한 이메일은 그대로 제품 로그인 대상이 된다. 제품 로그인은 소문자로
 * 비교하므로 저장 전에 소문자로 맞춰 둔다.
 */
const userEmailSchema = z
  .string({ error: ERROR_MESSAGES.EMAIL_REQUIRED })
  .trim()
  .min(1, ERROR_MESSAGES.EMAIL_REQUIRED)
  .email(ERROR_MESSAGES.EMAIL_INVALID_FORMAT)
  .toLowerCase();

/** 목록 기본값은 `all`이다 — 정지 계정이 기본으로 숨으면 어드민이 정지 사실을 놓친다. */
export const userStatusFilterSchema = z.enum(["all", "active", "deactivated"], {
  error: ERROR_MESSAGES.USER_STATUS_INVALID,
});

export const adminUserListQuerySchema = listQuerySchema.extend({
  status: userStatusFilterSchema.default("all"),
});

export const adminUserParamsSchema = z.object({
  userId: z.uuid({ error: ERROR_MESSAGES.USER_ID_INVALID }),
});

export const createUserSchema = z
  .object({
    email: userEmailSchema,
    name: accountNameSchema,
    password: passwordSchema,
  })
  .strict();

export type UserStatusFilter = z.infer<typeof userStatusFilterSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
