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

export const updateUserSchema = z
  .object({
    name: accountNameSchema.optional(),
    email: userEmailSchema.optional(),
  })
  .strict()
  .refine(({ name, email }) => name !== undefined || email !== undefined, {
    message: ERROR_MESSAGES.USER_UPDATE_FIELDS_REQUIRED,
  });

/*
 * 하드 삭제는 되돌릴 수 없으므로 대상 이메일을 다시 입력받는다. 목록에서 행을 잘못
 * 고른 삭제를 막는 장치라, 일치 여부는 실제 사용자 레코드와 대조해 서비스가 판단한다.
 */
export const deleteUserSchema = z.object({ email: userEmailSchema }).strict();

/* 어드민 재설정은 현재 비밀번호를 묻지 않는다 — 어드민은 사용자의 비밀번호를 모른다. */
export const resetUserPasswordSchema = z.object({ newPassword: passwordSchema }).strict();

export type UserStatusFilter = z.infer<typeof userStatusFilterSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetUserPasswordInput = z.infer<typeof resetUserPasswordSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
