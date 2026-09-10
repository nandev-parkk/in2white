import { Router } from "express";
import { addMemberHandler, listMembersHandler } from "@/controllers/member.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const memberRouter = Router({ mergeParams: true });

memberRouter.get("/", authenticate, asyncHandler(listMembersHandler));
memberRouter.post("/", authenticate, asyncHandler(addMemberHandler));
