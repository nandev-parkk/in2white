import { Router } from "express";
import { listMemberCandidatesHandler } from "@/controllers/member.controller";
import {
  createWorkspaceHandler,
  deleteWorkspaceHandler,
  getWorkspaceDetailHandler,
  listWorkspacesHandler,
  updateWorkspaceHandler,
} from "@/controllers/workspace.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const workspaceRouter = Router();

workspaceRouter.post("/", authenticate, asyncHandler(createWorkspaceHandler));
workspaceRouter.get("/", authenticate, asyncHandler(listWorkspacesHandler));
workspaceRouter.get("/:workspaceId", authenticate, asyncHandler(getWorkspaceDetailHandler));
workspaceRouter.patch("/:workspaceId", authenticate, asyncHandler(updateWorkspaceHandler));
workspaceRouter.delete("/:workspaceId", authenticate, asyncHandler(deleteWorkspaceHandler));

workspaceRouter.get(
  "/:workspaceId/member-candidates",
  authenticate,
  asyncHandler(listMemberCandidatesHandler),
);
