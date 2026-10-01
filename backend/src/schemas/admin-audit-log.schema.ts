import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";
import { paginationQuerySchema } from "@/schemas/list-query.schema";

/*
 * 감사 로그 목록의 필터다. 대상 타입은 기록 쪽과 조회 쪽이 같은 값을 써야 하므로 이 enum이
 * 유일한 출처다 — 서비스의 `AuditTargetType`도 여기서 파생된다.
 */
export const auditTargetTypeSchema = z.enum(
  ["user", "workspace", "project", "whiteboard_document", "admin"],
  { error: ERROR_MESSAGES.AUDIT_TARGET_TYPE_INVALID },
);

/*
 * 액션은 `user.update`처럼 점으로 구분된 값이다. `user.`만 넣어도 사용자 관련 기록을 묶어
 * 볼 수 있도록 부분 일치로 찾는다 — 완전 일치는 어드민이 전체 값을 외우고 있어야 한다.
 */
const auditActionSchema = z
  .string({ error: ERROR_MESSAGES.AUDIT_ACTION_INVALID })
  .trim()
  .max(64, { error: ERROR_MESSAGES.AUDIT_ACTION_TOO_LONG })
  .optional()
  .transform((action) => action || undefined);

/* 쿼리 문자열로 들어오므로 `2026-09-01`과 ISO 문자열을 모두 Date로 바꾼다. */
const auditPeriodSchema = z.coerce.date({ error: ERROR_MESSAGES.AUDIT_PERIOD_INVALID }).optional();

export const adminAuditLogListQuerySchema = paginationQuerySchema
  .extend({
    adminId: z.uuid({ error: ERROR_MESSAGES.ADMIN_ID_INVALID }).optional(),
    action: auditActionSchema,
    targetType: auditTargetTypeSchema.optional(),
    from: auditPeriodSchema,
    to: auditPeriodSchema,
  })
  /* 거꾸로 된 기간은 빈 목록만 돌려준다. 결과가 없는 이유를 조건 탓으로 알려준다. */
  .refine(({ from, to }) => !from || !to || from <= to, {
    error: ERROR_MESSAGES.AUDIT_PERIOD_REVERSED,
    path: ["from"],
  });

export type AuditTargetType = z.infer<typeof auditTargetTypeSchema>;
export type AdminAuditLogListQuery = z.infer<typeof adminAuditLogListQuerySchema>;
