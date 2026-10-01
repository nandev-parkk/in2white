import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { adminUsers } from "@/db/schema/admin-users";

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /*
     * 다른 참조는 모두 cascade지만 이것만 restrict다. 감사 로그가 어드민 삭제로
     * 함께 사라지면 감사 기능 자체가 무의미해진다.
     */
    adminId: uuid("admin_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "restrict" }),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }).notNull(),
    /** 계정 생성처럼 대상이 아직 없는 행위도 기록한다. */
    targetId: uuid("target_id"),
    summary: varchar("summary", { length: 255 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: varchar("ip", { length: 45 }),
    userAgent: varchar("user_agent", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // 감사 로그 목록(최신순)
    index().on(table.createdAt.desc()),
    // 특정 대상의 변경 이력
    index().on(table.targetType, table.targetId),
    // 특정 어드민의 행위 이력(최신순)
    index().on(table.adminId, table.createdAt.desc()),
  ],
);

export const insertAdminAuditLogSchema = createInsertSchema(adminAuditLogs);
export const selectAdminAuditLogSchema = createSelectSchema(adminAuditLogs);
