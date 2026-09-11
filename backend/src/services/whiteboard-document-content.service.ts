import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { whiteboardDocumentContents, whiteboardDocuments } from "@/db/schema";
import {
  whiteboardFileIdSchema,
  whiteboardFileSchema,
} from "@/realtime/whiteboard-protocol.schema";
import type { CanvasContent, WhiteboardElement, WhiteboardSnapshot } from "@/types/whiteboard";

export const EMPTY_CANVAS_CONTENT: CanvasContent = { elements: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidWhiteboardElement(value: unknown): value is WhiteboardElement {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 255 &&
    typeof value.version === "number" &&
    Number.isInteger(value.version) &&
    value.version >= 0 &&
    typeof value.versionNonce === "number" &&
    Number.isInteger(value.versionNonce) &&
    value.versionNonce >= 0 &&
    typeof value.isDeleted === "boolean"
  );
}

export function normalizeCanvasContent(value: unknown): CanvasContent {
  if (!isRecord(value)) {
    throw new Error("Invalid whiteboard canvas content");
  }

  const normalized: CanvasContent = { elements: [] };

  if (value.files !== undefined) {
    if (!isRecord(value.files)) {
      throw new Error("Invalid whiteboard canvas files");
    }

    const files: NonNullable<CanvasContent["files"]> = {};
    for (const [fileId, file] of Object.entries(value.files)) {
      const parsed = whiteboardFileSchema.safeParse(file);
      if (
        !whiteboardFileIdSchema.safeParse(fileId).success ||
        !isRecord(file) ||
        file.id !== fileId
      ) {
        throw new Error("Invalid whiteboard canvas files");
      }
      files[fileId] = parsed.success ? parsed.data : { ...file, id: fileId };
    }
    normalized.files = files;
  }

  if (value.elements === undefined) {
    return normalized;
  }

  if (!Array.isArray(value.elements) || !value.elements.every(isValidWhiteboardElement)) {
    throw new Error("Invalid whiteboard canvas elements");
  }

  normalized.elements = value.elements;
  return normalized;
}

export async function getWhiteboardDocumentContent(
  documentId: string,
): Promise<WhiteboardSnapshot> {
  const [content] = await db
    .select({
      canvasContent: whiteboardDocumentContents.canvasContent,
      revision: whiteboardDocumentContents.revision,
      updatedAt: whiteboardDocumentContents.updatedAt,
    })
    .from(whiteboardDocumentContents)
    .where(eq(whiteboardDocumentContents.documentId, documentId));

  if (!content) {
    throw new Error("Whiteboard document content not found");
  }

  return {
    canvasContent: normalizeCanvasContent(content.canvasContent),
    revision: content.revision,
    lastSavedAt: content.updatedAt,
  };
}

export interface SaveWhiteboardDocumentContentInput {
  documentId: string;
  canvasContent: CanvasContent;
  expectedRevision: number;
  revision: number;
}

export type SaveWhiteboardDocumentContentResult =
  | { status: "saved"; lastSavedAt: Date }
  | { status: "conflict" }
  | { status: "not_found" }
  | { status: "content_missing" };

export async function saveWhiteboardDocumentContent({
  documentId,
  canvasContent,
  expectedRevision,
  revision,
}: SaveWhiteboardDocumentContentInput): Promise<SaveWhiteboardDocumentContentResult> {
  const normalizedCanvasContent = normalizeCanvasContent(canvasContent);

  return db.transaction(async (tx) => {
    const [document] = await tx
      .select({ id: whiteboardDocuments.id })
      .from(whiteboardDocuments)
      .where(and(eq(whiteboardDocuments.id, documentId), isNull(whiteboardDocuments.deletedAt)))
      .for("update");

    if (!document) {
      return { status: "not_found" };
    }

    const now = new Date();
    const [savedContent] = await tx
      .update(whiteboardDocumentContents)
      .set({
        canvasContent: normalizedCanvasContent,
        revision,
        updatedAt: now,
      })
      .where(
        and(
          eq(whiteboardDocumentContents.documentId, documentId),
          eq(whiteboardDocumentContents.revision, expectedRevision),
        ),
      )
      .returning({ updatedAt: whiteboardDocumentContents.updatedAt });

    if (!savedContent) {
      const [existingContent] = await tx
        .select({ id: whiteboardDocumentContents.documentId })
        .from(whiteboardDocumentContents)
        .where(eq(whiteboardDocumentContents.documentId, documentId));

      return existingContent ? { status: "conflict" } : { status: "content_missing" };
    }

    await tx
      .update(whiteboardDocuments)
      .set({ updatedAt: now })
      .where(and(eq(whiteboardDocuments.id, documentId), isNull(whiteboardDocuments.deletedAt)));

    return { status: "saved", lastSavedAt: savedContent.updatedAt };
  });
}
