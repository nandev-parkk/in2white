import { Router } from "express";
import {
  deleteProjectHandler,
  getProjectDetailHandler,
  listProjectsHandler,
  restoreProjectHandler,
} from "@/controllers/admin-project.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { adminApiRateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const adminProjectRouter = Router();

/* 라우터 전체에 한 번 건다. 엔드포인트마다 붙이면 하나를 빠뜨렸을 때 조용히 열린다. */
adminProjectRouter.use(authenticateAdmin, adminApiRateLimitMiddleware);

adminProjectRouter.get("/", asyncHandler(listProjectsHandler));
adminProjectRouter.get("/:projectId", asyncHandler(getProjectDetailHandler));
adminProjectRouter.delete("/:projectId", asyncHandler(deleteProjectHandler));

/* 복구는 상태 변경이라 POST다 — 링크 클릭이나 프리페치로 실행되면 안 된다. */
adminProjectRouter.post("/:projectId/restore", asyncHandler(restoreProjectHandler));
