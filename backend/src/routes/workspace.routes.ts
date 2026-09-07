import { Router } from "express";
import {
  createWorkspaceHandler,
  listWorkspacesHandler,
  updateWorkspaceHandler,
} from "@/controllers/workspace.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const workspaceRouter = Router();

workspaceRouter.post("/", authenticate, asyncHandler(createWorkspaceHandler));
workspaceRouter.get("/", authenticate, asyncHandler(listWorkspacesHandler));
workspaceRouter.patch("/:workspaceId", authenticate, asyncHandler(updateWorkspaceHandler));
