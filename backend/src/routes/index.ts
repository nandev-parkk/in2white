import { Router } from "express";
import { healthRouter } from "@/routes/health.routes";
import { authRouter } from "@/routes/auth.routes";
import { memberRouter } from "@/routes/member.routes";
import { projectRouter } from "@/routes/project.routes";
import { workspaceRouter } from "@/routes/workspace.routes";

export const router = Router();

router.use("/health", healthRouter);
router.use("/auth", authRouter);
router.use("/workspaces/:workspaceId/projects", projectRouter);
router.use("/workspaces/:workspaceId/members", memberRouter);
router.use("/workspaces", workspaceRouter);
