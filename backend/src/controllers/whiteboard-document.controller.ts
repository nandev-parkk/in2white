import type { Request, Response } from "express";
import {
  createWhiteboardDocumentSchema,
  whiteboardDocumentParamsSchema,
} from "@/schemas/whiteboard-document.schema";
import { createWhiteboardDocument } from "@/services/whiteboard-document.service";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireUser } from "@/utils/require-user";

export async function createWhiteboardDocumentHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId } = parseOrThrow(whiteboardDocumentParamsSchema, req.params);
  const { name } = parseOrThrow(createWhiteboardDocumentSchema, req.body);

  const whiteboardDocument = await createWhiteboardDocument({
    workspaceId,
    projectId,
    name,
    creatorId: user.sub,
  });

  res.status(201).json({ whiteboardDocument });
}
