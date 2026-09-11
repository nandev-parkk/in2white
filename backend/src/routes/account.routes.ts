import { Router } from "express";
import {
  changeAccountPasswordHandler,
  getAccountHandler,
  updateAccountHandler,
} from "@/controllers/account.controller";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const accountRouter = Router();

accountRouter.get("/", authenticate, asyncHandler(getAccountHandler));
accountRouter.patch("/", authenticate, asyncHandler(updateAccountHandler));
accountRouter.patch("/password", authenticate, asyncHandler(changeAccountPasswordHandler));
