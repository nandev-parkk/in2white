import { Router } from "express";
import {
  changeAccountPasswordHandler,
  getAccountHandler,
  updateAccountHandler,
} from "@/controllers/account.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import {
  productApiRateLimitMiddleware,
  productPasswordChangeRateLimitMiddleware,
} from "@/middlewares/rate-limit.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const accountRouter = Router();

accountRouter.get(
  "/",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(getAccountHandler),
);
accountRouter.patch(
  "/",
  authenticate,
  productApiRateLimitMiddleware,
  asyncHandler(updateAccountHandler),
);
accountRouter.patch(
  "/password",
  authenticate,
  productPasswordChangeRateLimitMiddleware,
  asyncHandler(changeAccountPasswordHandler),
);
