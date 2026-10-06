import { Router } from "express";
import {
  createWhiteboardDocumentHandler,
  createDeleteWhiteboardDocumentHandler,
  getWhiteboardDocumentHandler,
  listWhiteboardDocumentsHandler,
  updateWhiteboardDocumentHandler,
} from "@/controllers/whiteboard-document.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { productApiRateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { asyncHandler } from "@/utils/async-handler";

export interface WhiteboardDocumentRouteDependencies {
  onDocumentDeleted?: (documentId: string) => void;
}

export function createWhiteboardDocumentRouter(
  dependencies: WhiteboardDocumentRouteDependencies = {},
): Router {
  const router = Router({ mergeParams: true });
  router.get(
    "/",
    authenticate,
    productApiRateLimitMiddleware,
    asyncHandler(listWhiteboardDocumentsHandler),
  );
  router.get(
    "/:documentId",
    authenticate,
    productApiRateLimitMiddleware,
    asyncHandler(getWhiteboardDocumentHandler),
  );
  router.post(
    "/",
    authenticate,
    productApiRateLimitMiddleware,
    asyncHandler(createWhiteboardDocumentHandler),
  );
  router.patch(
    "/:documentId",
    authenticate,
    productApiRateLimitMiddleware,
    asyncHandler(updateWhiteboardDocumentHandler),
  );
  router.delete(
    "/:documentId",
    authenticate,
    productApiRateLimitMiddleware,
    asyncHandler(
      createDeleteWhiteboardDocumentHandler({
        onDocumentDeleted: dependencies.onDocumentDeleted,
      }),
    ),
  );
  return router;
}
