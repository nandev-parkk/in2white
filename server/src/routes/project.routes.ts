import { Router } from "express";
import {
  createProjectHandler,
  deleteProjectHandler,
  getProjectDetailHandler,
  listProjectsHandler,
  updateProjectHandler,
} from "@/controllers/project.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";
import { productApiRateLimitMiddleware } from "@/middlewares/rate-limit.middleware";

export const projectRouter = Router({ mergeParams: true });

projectRouter.get(
  "/",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(listProjectsHandler),
);
projectRouter.get(
  "/:projectId",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(getProjectDetailHandler),
);
projectRouter.post(
  "/",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(createProjectHandler),
);
projectRouter.patch(
  "/:projectId",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(updateProjectHandler),
);
projectRouter.delete(
  "/:projectId",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(deleteProjectHandler),
);
