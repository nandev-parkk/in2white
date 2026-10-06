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

export const projectRouter = Router({ mergeParams: true });

projectRouter.get("/", authenticate, asyncHandler(listProjectsHandler));
projectRouter.get("/:projectId", authenticate, asyncHandler(getProjectDetailHandler));
projectRouter.post("/", authenticate, asyncHandler(createProjectHandler));
projectRouter.patch("/:projectId", authenticate, asyncHandler(updateProjectHandler));
projectRouter.delete("/:projectId", authenticate, asyncHandler(deleteProjectHandler));
