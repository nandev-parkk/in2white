import { bigint, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import type { CanvasContent } from "@/types/whiteboard";
import { whiteboardDocuments } from "@/db/schema/whiteboard-documents";

export const whiteboardDocumentContents = pgTable("whiteboard_document_contents", {
  documentId: uuid("document_id")
    .primaryKey()
    .references(() => whiteboardDocuments.id, { onDelete: "cascade" }),
  canvasContent: jsonb("canvas_content").$type<CanvasContent>().notNull().default({ elements: [] }),
  revision: bigint("revision", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
