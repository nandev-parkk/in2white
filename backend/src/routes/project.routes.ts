import { Router } from "express";
import {
  createProjectHandler,
  listProjectsHandler,
  updateProjectHandler,
} from "@/controllers/project.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const projectRouter = Router({ mergeParams: true });

projectRouter.get("/", authenticate, asyncHandler(listProjectsHandler));
projectRouter.post("/", authenticate, asyncHandler(createProjectHandler));
projectRouter.patch("/:projectId", authenticate, asyncHandler(updateProjectHandler));
