import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

const migrationSql = readFileSync(
  fileURLToPath(new URL("../src/db/migrations/0005_greedy_shriek.sql", import.meta.url)),
  "utf8",
);

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
