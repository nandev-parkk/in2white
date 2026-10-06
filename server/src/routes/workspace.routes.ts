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
import { productApiRateLimitMiddleware } from "@/middlewares/rate-limit.middleware";

export const workspaceRouter = Router();

workspaceRouter.post(
  "/",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(createWorkspaceHandler),
);
workspaceRouter.get(
  "/",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(listWorkspacesHandler),
);
workspaceRouter.get(
  "/:workspaceId",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(getWorkspaceDetailHandler),
);
workspaceRouter.patch(
  "/:workspaceId",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(updateWorkspaceHandler),
);
workspaceRouter.delete(
  "/:workspaceId",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(deleteWorkspaceHandler),
);

workspaceRouter.get(
  "/:workspaceId/member-candidates",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(listMemberCandidatesHandler),
);
