import { Router } from "express";
import { createProjectHandler } from "@/controllers/project.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const projectRouter = Router({ mergeParams: true });

projectRouter.post("/", authenticate, asyncHandler(createProjectHandler));
