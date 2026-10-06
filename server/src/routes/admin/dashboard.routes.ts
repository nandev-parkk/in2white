import { Router } from "express";
import { getDashboardMetricsHandler } from "@/controllers/admin-dashboard.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const adminDashboardRouter = Router();

/* 라우터 전체에 한 번 건다. 엔드포인트마다 붙이면 하나를 빠뜨렸을 때 조용히 열린다. */
adminDashboardRouter.use(authenticateAdmin);

adminDashboardRouter.get("/metrics", asyncHandler(getDashboardMetricsHandler));
