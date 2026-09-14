import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";
import { authRouter } from "@/routes/auth.routes";
import { memberRouter } from "@/routes/member.routes";
import { accountRouter } from "@/routes/account.routes";
import { projectRouter } from "@/routes/project.routes";
import {
  createWhiteboardDocumentRouter,
  type WhiteboardDocumentRouteDependencies,
} from "@/routes/whiteboard-document.routes";
import { workspaceRouter } from "@/routes/workspace.routes";

export function createRouter(dependencies: WhiteboardDocumentRouteDependencies = {}): Router {
  const router = Router();
  router.use("/health", healthRouter);
  router.use("/auth", authRouter);
  router.use("/account", accountRouter);
  router.use("/workspaces/:workspaceId/projects", projectRouter);
  router.use(
    "/workspaces/:workspaceId/projects/:projectId/whiteboard-documents",
    createWhiteboardDocumentRouter(dependencies),
  );
  router.use("/workspaces/:workspaceId/members", memberRouter);
  router.use("/workspaces", workspaceRouter);
  return router;
}
