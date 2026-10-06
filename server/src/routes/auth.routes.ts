import { Router } from "express";
import { authenticate } from "@/middlewares/auth.middleware";
import { asyncHandler } from "@/utils/async-handler";
import { loginHandler, logoutHandler, refreshHandler } from "@/controllers/auth.controller";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(loginHandler));
authRouter.post("/refresh", asyncHandler(refreshHandler));
authRouter.post("/logout", authenticate, asyncHandler(logoutHandler));
