import { Router } from "express";
import { createUserHandler, listUsersHandler } from "@/controllers/admin-user.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const adminUserRouter = Router();

/* 라우터 전체에 한 번 건다. 엔드포인트마다 붙이면 하나를 빠뜨렸을 때 조용히 열린다. */
adminUserRouter.use(authenticateAdmin);

adminUserRouter.get("/", asyncHandler(listUsersHandler));
adminUserRouter.post("/", asyncHandler(createUserHandler));
