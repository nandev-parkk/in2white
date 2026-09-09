import type { Request, Response } from "express";
import { listQuerySchema } from "@/schemas/list-query.schema";
import {
  createWhiteboardDocumentSchema,
  whiteboardDocumentParamsSchema,
} from "@/schemas/whiteboard-document.schema";
import {
  createWhiteboardDocument,
  listWhiteboardDocuments,
} from "@/services/whiteboard-document.service";
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

export async function listWhiteboardDocumentsHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId } = parseOrThrow(whiteboardDocumentParamsSchema, req.params);
  const { search, page, limit } = parseOrThrow(listQuerySchema, req.query);

  const result = await listWhiteboardDocuments({
    workspaceId,
    projectId,
    userId: user.sub,
    search,
    page,
    limit,
  });

  res.status(200).json(result);
}
