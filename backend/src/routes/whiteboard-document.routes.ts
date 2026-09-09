import { Router } from "express";
import { createWhiteboardDocumentHandler } from "@/controllers/whiteboard-document.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const whiteboardDocumentRouter = Router({ mergeParams: true });

whiteboardDocumentRouter.post("/", authenticate, asyncHandler(createWhiteboardDocumentHandler));
