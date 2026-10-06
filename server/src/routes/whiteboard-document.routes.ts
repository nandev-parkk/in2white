import { Router } from "express";
import {
  createWhiteboardDocumentHandler,
  createDeleteWhiteboardDocumentHandler,
  getWhiteboardDocumentHandler,
  listWhiteboardDocumentsHandler,
  updateWhiteboardDocumentHandler,
} from "@/controllers/whiteboard-document.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export interface WhiteboardDocumentRouteDependencies {
  onDocumentDeleted?: (documentId: string) => void;
}

export function createWhiteboardDocumentRouter(
  dependencies: WhiteboardDocumentRouteDependencies = {},
): Router {
  const router = Router({ mergeParams: true });
  router.get("/", authenticate, asyncHandler(listWhiteboardDocumentsHandler));
  router.get("/:documentId", authenticate, asyncHandler(getWhiteboardDocumentHandler));
  router.post("/", authenticate, asyncHandler(createWhiteboardDocumentHandler));
  router.patch("/:documentId", authenticate, asyncHandler(updateWhiteboardDocumentHandler));
  router.delete(
    "/:documentId",
    authenticate,
    asyncHandler(
      createDeleteWhiteboardDocumentHandler({
        onDocumentDeleted: dependencies.onDocumentDeleted,
      }),
    ),
  );
  return router;
}
