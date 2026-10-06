import { globSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

const migrationsDir = fileURLToPath(new URL("../src/db/migrations", import.meta.url));

/** drizzle-kit이 붙이는 임의의 접미사를 피해 번호로만 찾는다. */
function readMigration(prefix: string) {
  const [file] = globSync(`${prefix}_*.sql`, { cwd: migrationsDir });
  if (!file) throw new Error(`${prefix} 마이그레이션을 찾을 수 없다`);
  return readFileSync(`${migrationsDir}/${file}`, "utf8");
}

const migrationSql = readMigration("0005");
const adminMigrationSql = readMigration("0006");

describe("db schema", () => {
  it("exports all six domain tables", () => {
    expect(schema.users).toBeDefined();
    expect(schema.workspaces).toBeDefined();
    expect(schema.workspaceMemberships).toBeDefined();
    expect(schema.projects).toBeDefined();
    expect(schema.whiteboardDocuments).toBeDefined();
  });

  it("projects schema exposes a nullable deletedAt column", () => {
    expect(schema.projects.deletedAt).toBeDefined();
  });

  it("whiteboardDocuments schema exposes a nullable deletedAt column", () => {
    expect(schema.whiteboardDocuments.deletedAt).toBeDefined();
  });

  it("exports the whiteboard document contents table", () => {
    expect(schema.whiteboardDocumentContents).toBeDefined();
    expect(schema.whiteboardDocumentContents.documentId).toBeDefined();
    expect(schema.whiteboardDocumentContents.canvasContent).toBeDefined();
    expect(schema.whiteboardDocumentContents.revision).toBeDefined();
    expect(schema.whiteboardDocumentContents.updatedAt).toBeDefined();
  });

  it("stores canvas content outside the document metadata table", () => {
    expect(getTableColumns(schema.whiteboardDocuments)).not.toHaveProperty("canvasContent");
  });

  it("backfills every whiteboard document before adding the foreign key and dropping the old column", () => {
    const createTableIndex = migrationSql.indexOf('CREATE TABLE "whiteboard_document_contents"');
    const backfillIndex = migrationSql.indexOf(
      'INSERT INTO "whiteboard_document_contents" ("document_id", "canvas_content", "revision", "updated_at")',
    );
    const foreignKeyIndex = migrationSql.indexOf(
      'ALTER TABLE "whiteboard_document_contents" ADD CONSTRAINT',
    );
    const dropColumnIndex = migrationSql.indexOf(
      'ALTER TABLE "whiteboard_documents" DROP COLUMN "canvas_content"',
    );

    expect(createTableIndex).toBeGreaterThanOrEqual(0);
    expect(backfillIndex).toBeGreaterThan(createTableIndex);
    expect(foreignKeyIndex).toBeGreaterThan(backfillIndex);
    expect(dropColumnIndex).toBeGreaterThan(foreignKeyIndex);
    expect(migrationSql).toContain('FROM "whiteboard_documents"');
    expect(migrationSql).not.toMatch(/FROM "whiteboard_documents"\s+WHERE/i);
    expect(migrationSql).toContain(
      `WHEN "canvas_content" = '{}'::jsonb THEN '{"elements":[]}'::jsonb`,
    );
  });

  it("users schema exposes a sessionVersion column with default zero", () => {
    expect(schema.users.sessionVersion).toBeDefined();
    expect(schema.users.sessionVersion.notNull).toBe(true);
    expect(schema.users.sessionVersion.hasDefault).toBe(true);
  });
});

describe("admin schema", () => {
  it("keeps admin credentials in their own table", () => {
    const columns = getTableColumns(schema.adminUsers);

    expect(Object.keys(columns).sort()).toEqual([
      "createdAt",
      "email",
      "id",
      "lastLoginAt",
      "name",
      "passwordHash",
      "sessionVersion",
    ]);
    expect(schema.adminUsers.email.isUnique).toBe(true);
    expect(schema.adminUsers.sessionVersion.notNull).toBe(true);
    expect(schema.adminUsers.sessionVersion.hasDefault).toBe(true);
    expect(schema.adminUsers.lastLoginAt.notNull).toBe(false);
  });

  it("does not add an admin flag to the product users table", () => {
    const columns = getTableColumns(schema.users);

    expect(columns).not.toHaveProperty("role");
    expect(columns).not.toHaveProperty("isAdmin");
  });

  it("records the actor, target and summary on every audit log row", () => {
    const columns = getTableColumns(schema.adminAuditLogs);

    expect(Object.keys(columns).sort()).toEqual([
      "action",
      "adminId",
      "createdAt",
      "id",
      "ip",
      "metadata",
      "summary",
      "targetId",
      "targetType",
      "userAgent",
    ]);
    expect(schema.adminAuditLogs.summary.notNull).toBe(true);
    expect(schema.adminAuditLogs.metadata.notNull).toBe(true);
    expect(schema.adminAuditLogs.metadata.hasDefault).toBe(true);
    // 계정 생성처럼 대상이 아직 없는 행위도 기록한다.
    expect(schema.adminAuditLogs.targetId.notNull).toBe(false);
  });

  it("exposes a nullable deactivatedAt column on users for soft suspension", () => {
    expect(schema.users.deactivatedAt).toBeDefined();
    expect(schema.users.deactivatedAt.notNull).toBe(false);
  });

  /*
   * 감사 로그가 어드민 삭제로 함께 사라지면 감사 기능의 목적이 무너진다.
   * 다른 참조는 모두 cascade이므로 이 테이블만 restrict인지 확인한다.
   */
  it("refuses to delete an admin that still owns audit logs", () => {
    expect(adminMigrationSql).toMatch(
      /ALTER TABLE "admin_audit_logs" ADD CONSTRAINT[\s\S]*?ON DELETE restrict/i,
    );
    expect(adminMigrationSql).not.toMatch(
      /ALTER TABLE "admin_audit_logs" ADD CONSTRAINT[\s\S]*?ON DELETE cascade/i,
    );
  });

  it("indexes the audit log for the three queries the console makes", () => {
    expect(adminMigrationSql).toMatch(
      /CREATE INDEX .*ON "admin_audit_logs" USING btree \("created_at" DESC/i,
    );
    expect(adminMigrationSql).toMatch(
      /CREATE INDEX .*ON "admin_audit_logs" USING btree \("target_type","target_id"\)/i,
    );
    expect(adminMigrationSql).toMatch(
      /CREATE INDEX .*ON "admin_audit_logs" USING btree \("admin_id","created_at" DESC/i,
    );
  });

  it("adds the suspension column without dropping product data", () => {
    expect(adminMigrationSql).toContain('ALTER TABLE "users" ADD COLUMN "deactivated_at"');
    expect(adminMigrationSql).not.toMatch(/DROP (TABLE|COLUMN)/i);
  });
});
