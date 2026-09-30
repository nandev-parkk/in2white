import { integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

/*
 * 어드민 자격증명은 `users`와 같은 테이블에 두지 않는다. 워크스페이스 Owner가
 * 멤버를 추가할 때 전체 사용자 목록을 조회하므로, 같은 테이블에 두면 모든 조회
 * 경로에 어드민 제외 필터가 필요해지고 하나만 빠져도 어드민 계정이 노출된다.
 */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  sessionVersion: integer("session_version").default(0).notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAdminUserSchema = createInsertSchema(adminUsers);
export const selectAdminUserSchema = createSelectSchema(adminUsers);
