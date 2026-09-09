import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";
import { authRouter } from "@/routes/auth.routes";
import { projectRouter } from "@/routes/project.routes";
import { whiteboardDocumentRouter } from "@/routes/whiteboard-document.routes";
import { workspaceRouter } from "@/routes/workspace.routes";

export const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/workspaces/:workspaceId/projects", projectRouter);
router.use(
  "/workspaces/:workspaceId/projects/:projectId/whiteboard-documents",
  whiteboardDocumentRouter,
);
router.use("/workspaces", workspaceRouter);
