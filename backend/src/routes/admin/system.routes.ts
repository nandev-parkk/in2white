import { Router } from "express";
import {
  createSystemStatusHandler,
  type SystemStatusHandlerDependencies,
} from "@/controllers/admin-system.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

/* 실시간 통계를 주입받아야 해서 다른 어드민 라우터와 달리 팩토리다. */
export function createAdminSystemRouter(
  dependencies: SystemStatusHandlerDependencies = {},
): Router {
  const router = Router();
  router.use(authenticateAdmin);
  router.get("/status", asyncHandler(createSystemStatusHandler(dependencies)));
  return router;
}
