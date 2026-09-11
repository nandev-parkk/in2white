import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const shouldRun = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1";
const describeDatabaseIntegration = shouldRun ? describe : describe.skip;
const postgresImage = process.env.TEST_POSTGRES_IMAGE ?? "postgres:17-alpine";
const migrationSql = readFileSync(
  fileURLToPath(new URL("../src/db/migrations/0005_greedy_shriek.sql", import.meta.url)),
  "utf8",
);

const ACTIVE_DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const DELETED_DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";

describeDatabaseIntegration("whiteboard contents migration", () => {
  let container: StartedPostgreSqlContainer | undefined;
  let sql: Sql | undefined;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(postgresImage).start();
    sql = postgres(container.getConnectionUri(), { max: 1 });

    await sql.unsafe(`
      CREATE TABLE "whiteboard_documents" (
        "id" uuid PRIMARY KEY NOT NULL,
        "canvas_content" jsonb DEFAULT '{}'::jsonb NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "deleted_at" timestamp with time zone
      );

      INSERT INTO "whiteboard_documents" ("id", "canvas_content", "updated_at", "deleted_at")
      VALUES
        ('${ACTIVE_DOCUMENT_ID}', '{}'::jsonb, '2026-09-10T01:02:03.000Z', NULL),
        (
          '${DELETED_DOCUMENT_ID}',
          '{"elements":[{"id":"shape-1","type":"rectangle"}],"files":{"file-1":{"id":"file-1","dataURL":"data:image/png;base64,AA==","mimeType":"image/png","created":1}}}'::jsonb,
          '2026-09-10T04:05:06.000Z',
          '2026-09-11T00:00:00.000Z'
        );
    `);
    await sql.unsafe(migrationSql);
  }, 120_000);

  afterAll(async () => {
    await sql?.end();
    await container?.stop();
  });

  it("backfills active and soft-deleted parents exactly once while preserving content metadata", async () => {
    const rows = await sql!`
      SELECT
        documents.id::text AS document_id,
        contents.canvas_content,
        contents.revision::text AS revision,
        contents.updated_at = documents.updated_at AS updated_at_preserved,
        documents.deleted_at IS NOT NULL AS soft_deleted
      FROM whiteboard_documents AS documents
      JOIN whiteboard_document_contents AS contents
        ON contents.document_id = documents.id
      ORDER BY documents.id
    `;

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      document_id: ACTIVE_DOCUMENT_ID,
      canvas_content: { elements: [] },
      revision: "0",
      updated_at_preserved: true,
      soft_deleted: false,
    });
    expect(rows[1]).toMatchObject({
      document_id: DELETED_DOCUMENT_ID,
      canvas_content: {
        elements: [{ id: "shape-1", type: "rectangle" }],
        files: {
          "file-1": {
            id: "file-1",
            dataURL: "data:image/png;base64,AA==",
            mimeType: "image/png",
            created: 1,
          },
        },
      },
      revision: "0",
      updated_at_preserved: true,
      soft_deleted: true,
    });
  });

  it("creates the content primary key and cascading parent foreign key", async () => {
    const constraints = await sql!`
      SELECT constraint_type, delete_rule
      FROM information_schema.table_constraints AS constraints
      LEFT JOIN information_schema.referential_constraints AS referential
        ON referential.constraint_schema = constraints.constraint_schema
        AND referential.constraint_name = constraints.constraint_name
      WHERE constraints.table_schema = 'public'
        AND constraints.table_name = 'whiteboard_document_contents'
      ORDER BY constraint_type
    `;

    expect(constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ constraint_type: "PRIMARY KEY" }),
        expect.objectContaining({ constraint_type: "FOREIGN KEY", delete_rule: "CASCADE" }),
      ]),
    );
  });

  it("removes canvas_content from the parent table", async () => {
    const columns = await sql!`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'whiteboard_documents'
    `;

    expect(columns.map((column) => column.column_name)).not.toContain("canvas_content");
  });
});
