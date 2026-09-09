import { z } from "zod";
import { ERROR_MESSAGES } from "@/constants/messages";

const whiteboardDocumentNameSchema = z
  .string({ error: ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NAME_REQUIRED })
  .trim()
  .min(1, ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NAME_REQUIRED)
  .max(50, ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NAME_TOO_LONG);

export const whiteboardDocumentParamsSchema = z.object({
  workspaceId: z.uuid({ error: ERROR_MESSAGES.WORKSPACE_ID_INVALID }),
  projectId: z.uuid({ error: ERROR_MESSAGES.PROJECT_ID_INVALID }),
});

export const createWhiteboardDocumentSchema = z.object({
  name: whiteboardDocumentNameSchema,
});
