import { and, asc, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { adminAuditLogs, adminUsers } from "@/db/schema";
import type { TransactionHandle } from "@/db/transaction";
import type { AuditTargetType } from "@/schemas/admin-audit-log.schema";
import type { PaginationMeta } from "@/utils/pagination";
import { createPaginationMeta, getPaginationOffset } from "@/utils/pagination";
import { buildContainsSearchPattern } from "@/utils/search";

/*
 * 대상 변경과 같은 트랜잭션에 기록하기 위해 핸들을 인자로 받는다. 전역 `db`를 쓰면
 * 변경은 롤백됐는데 로그만 남거나, 변경은 성공했는데 로그가 없는 상태가 생긴다.
 */

export type { AuditTargetType };

export interface AuditLogEntry {
  adminId: string;
  /** 예: `user.create`, `workspace.delete` */
  action: string;
  targetType: AuditTargetType;
  /** 계정 생성처럼 대상이 아직 없는 행위는 비워둔다. */
  targetId?: string;
  /** 목록에 그대로 보여줄 한국어 요약. */
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

/*
 * 감사 로그는 조회 UI에 그대로 노출되고 오래 남는다. 비밀번호 해시나 평문이 한 번
 * 들어가면 회수할 방법이 없으므로 호출자를 믿지 않고 기록 직전에 걸러낸다.
 */
const SECRET_KEY_PATTERN = /password|secret|token|credential/i;

/** 비밀번호 재설정은 `{ passwordReset: true }`만 남기기로 했다. 이 키는 값이 없는 표식이다. */
const ALLOWED_KEYS = new Set(["passwordReset"]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value === null || typeof value !== "object" || value instanceof Date) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY_PATTERN.test(key) && !ALLOWED_KEYS.has(key)) continue;
    result[key] = redact(nested);
  }
  return result;
}

function redactMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  return redact(metadata) as Record<string, unknown>;
}

export async function recordAuditLog(tx: TransactionHandle, entry: AuditLogEntry) {
  const [log] = await tx
    .insert(adminAuditLogs)
    .values({
      adminId: entry.adminId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      summary: entry.summary,
      metadata: redactMetadata(entry.metadata),
      ip: entry.ip,
      userAgent: entry.userAgent,
    })
    .returning();

  if (!log) {
    throw new Error("Audit log insert returned no row");
  }

  return log;
}

export interface AdminAuditLogAdmin {
  id: string;
  email: string;
  name: string;
}

export interface AdminAuditLogListItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  admin: AdminAuditLogAdmin;
}

export interface ListAuditLogsInput {
  adminId?: string;
  action?: string;
  targetType?: AuditTargetType;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export interface ListAuditLogsResult {
  auditLogs: AdminAuditLogListItem[];
  pagination: PaginationMeta;
}

const AUDIT_LOG_COLUMNS = {
  id: adminAuditLogs.id,
  action: adminAuditLogs.action,
  targetType: adminAuditLogs.targetType,
  targetId: adminAuditLogs.targetId,
  summary: adminAuditLogs.summary,
  metadata: adminAuditLogs.metadata,
  ip: adminAuditLogs.ip,
  userAgent: adminAuditLogs.userAgent,
  createdAt: adminAuditLogs.createdAt,
} as const;

/* 어드민 계정 참조는 restrict라 삭제되지 않는다 — inner join으로 빠지는 행이 없다. */
const AUDIT_LOG_ADMIN_COLUMNS = {
  adminId: adminUsers.id,
  adminEmail: adminUsers.email,
  adminName: adminUsers.name,
} as const;

interface AuditLogFlatRow {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  adminId: string;
  adminEmail: string;
  adminName: string;
}

function toAuditLogListItem({
  adminId,
  adminEmail,
  adminName,
  ...log
}: AuditLogFlatRow): AdminAuditLogListItem {
  return { ...log, admin: { id: adminId, email: adminEmail, name: adminName } };
}

export async function listAuditLogs({
  adminId,
  action,
  targetType,
  from,
  to,
  page,
  limit,
}: ListAuditLogsInput): Promise<ListAuditLogsResult> {
  const whereCondition = and(
    adminId ? eq(adminAuditLogs.adminId, adminId) : undefined,
    action ? ilike(adminAuditLogs.action, buildContainsSearchPattern(action)) : undefined,
    targetType ? eq(adminAuditLogs.targetType, targetType) : undefined,
    from ? gte(adminAuditLogs.createdAt, from) : undefined,
    to ? lte(adminAuditLogs.createdAt, to) : undefined,
  );

  const [countRows, logRows] = await Promise.all([
    db.select({ total: count() }).from(adminAuditLogs).where(whereCondition),
    db
      .select({ ...AUDIT_LOG_COLUMNS, ...AUDIT_LOG_ADMIN_COLUMNS })
      .from(adminAuditLogs)
      .innerJoin(adminUsers, eq(adminAuditLogs.adminId, adminUsers.id))
      .where(whereCondition)
      /* 같은 밀리초에 기록된 로그가 페이지 경계에서 흔들리지 않게 id로 한 번 더 정렬한다. */
      .orderBy(desc(adminAuditLogs.createdAt), asc(adminAuditLogs.id))
      .limit(limit)
      .offset(getPaginationOffset({ page, limit })),
  ]);

  return {
    auditLogs: logRows.map(toAuditLogListItem),
    pagination: createPaginationMeta({ page, limit, total: Number(countRows[0]?.total ?? 0) }),
  };
}
