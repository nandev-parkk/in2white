CREATE TABLE "whiteboard_document_contents" (
	"document_id" uuid PRIMARY KEY NOT NULL,
	"canvas_content" jsonb DEFAULT '{"elements":[]}'::jsonb NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "whiteboard_document_contents" ("document_id", "canvas_content", "revision", "updated_at")
SELECT
	"id",
	CASE
		WHEN "canvas_content" = '{}'::jsonb THEN '{"elements":[]}'::jsonb
		ELSE "canvas_content"
	END,
	0,
	"updated_at"
FROM "whiteboard_documents";
--> statement-breakpoint
ALTER TABLE "whiteboard_document_contents" ADD CONSTRAINT "whiteboard_document_contents_document_id_whiteboard_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."whiteboard_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whiteboard_documents" DROP COLUMN "canvas_content";
