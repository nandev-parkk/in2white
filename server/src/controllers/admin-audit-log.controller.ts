import type { Request, Response } from "express";
import { adminAuditLogListQuerySchema } from "@/schemas/admin-audit-log.schema";
import { listAuditLogs } from "@/services/admin-audit-log.service";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireAdmin } from "@/utils/require-admin";

/* 감사 로그 조회 자체는 기록하지 않는다. 기록하면 로그가 자기 자신의 조회로 가득 찬다. */
export async function listAuditLogsHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { adminId, action, targetType, from, to, page, limit } = parseOrThrow(
    adminAuditLogListQuerySchema,
    req.query,
  );

  const result = await listAuditLogs({ adminId, action, targetType, from, to, page, limit });

  res.status(200).json(result);
}
