import { Router } from "express";
import { listMembersHandler } from "@/controllers/member.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const memberRouter = Router({ mergeParams: true });

memberRouter.get("/", authenticate, asyncHandler(listMembersHandler));
