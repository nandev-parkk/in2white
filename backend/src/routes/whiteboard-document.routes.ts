import { Router } from "express";
import {
  createWhiteboardDocumentHandler,
  deleteWhiteboardDocumentHandler,
  listWhiteboardDocumentsHandler,
  updateWhiteboardDocumentHandler,
} from "@/controllers/whiteboard-document.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const whiteboardDocumentRouter = Router({ mergeParams: true });

whiteboardDocumentRouter.get("/", authenticate, asyncHandler(listWhiteboardDocumentsHandler));
whiteboardDocumentRouter.post("/", authenticate, asyncHandler(createWhiteboardDocumentHandler));
whiteboardDocumentRouter.patch(
  "/:documentId",
  authenticate,
  asyncHandler(updateWhiteboardDocumentHandler),
);
whiteboardDocumentRouter.delete(
  "/:documentId",
  authenticate,
  asyncHandler(deleteWhiteboardDocumentHandler),
);
