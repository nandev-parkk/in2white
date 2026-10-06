import { Router } from "express";
import {
  addMemberHandler,
  listMembersHandler,
  removeMemberHandler,
} from "@/controllers/member.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";
import { productApiRateLimitMiddleware } from "@/middlewares/rate-limit.middleware";

export const memberRouter = Router({ mergeParams: true });

memberRouter.get(
  "/",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(listMembersHandler),
);
memberRouter.post("/", authenticate, productApiRateLimitMiddleware, asyncHandler(addMemberHandler));
memberRouter.delete(
  "/:userId",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(removeMemberHandler),
);
