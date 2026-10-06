import type { Request, Response } from "express";
import { listQuerySchema } from "@/schemas/list-query.schema";
import {
  createWhiteboardDocumentSchema,
  updateWhiteboardDocumentSchema,
  whiteboardDocumentParamsSchema,
  whiteboardDocumentUpdateParamsSchema,
} from "@/schemas/whiteboard-document.schema";
import {
  createWhiteboardDocument,
  deleteWhiteboardDocument,
  getWhiteboardDocument,
  listWhiteboardDocuments,
  updateWhiteboardDocument,
} from "@/services/whiteboard-document.service";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireUser } from "@/utils/require-user";
import { logger } from "@/utils/logger";

export interface DeleteWhiteboardDocumentHandlerDependencies {
  onDocumentDeleted?: (documentId: string) => void;
}

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

export async function getWhiteboardDocumentHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId, documentId } = parseOrThrow(
    whiteboardDocumentUpdateParamsSchema,
    req.params,
  );

  const whiteboardDocument = await getWhiteboardDocument({
    workspaceId,
    projectId,
    documentId,
    userId: user.sub,
  });

  res.status(200).json({ whiteboardDocument });
}

export async function updateWhiteboardDocumentHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const { workspaceId, projectId, documentId } = parseOrThrow(
    whiteboardDocumentUpdateParamsSchema,
    req.params,
  );
  const { name } = parseOrThrow(updateWhiteboardDocumentSchema, req.body);

  const whiteboardDocument = await updateWhiteboardDocument({
    workspaceId,
    projectId,
    documentId,
    userId: user.sub,
    name,
  });

  res.status(200).json({ whiteboardDocument });
}

export function createDeleteWhiteboardDocumentHandler(
  dependencies: DeleteWhiteboardDocumentHandlerDependencies = {},
) {
  return async function deleteWhiteboardDocumentHandler(req: Request, res: Response) {
    const user = requireUser(req);
    const { workspaceId, projectId, documentId } = parseOrThrow(
      whiteboardDocumentUpdateParamsSchema,
      req.params,
    );

    await deleteWhiteboardDocument({
      workspaceId,
      projectId,
      documentId,
      userId: user.sub,
    });

    try {
      dependencies.onDocumentDeleted?.(documentId);
    } catch (error) {
      logger.error(
        { documentId, errorName: error instanceof Error ? error.name : "UnknownError" },
        "Whiteboard realtime deletion hook failed",
      );
    }

    res.status(204).send();
  };
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
