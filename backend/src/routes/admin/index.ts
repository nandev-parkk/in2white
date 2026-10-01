import { Router } from "express";
import type { SystemStatusHandlerDependencies } from "@/controllers/admin-system.controller";
import { adminAuditLogRouter } from "@/routes/admin/audit-log.routes";
import { adminAuthRouter } from "@/routes/admin/auth.routes";
import { adminDashboardRouter } from "@/routes/admin/dashboard.routes";
import { adminProjectRouter } from "@/routes/admin/project.routes";
import { createAdminSystemRouter } from "@/routes/admin/system.routes";
import { adminUserRouter } from "@/routes/admin/user.routes";
import { adminWhiteboardDocumentRouter } from "@/routes/admin/whiteboard-document.routes";
import { adminWorkspaceRouter } from "@/routes/admin/workspace.routes";

/*
 * 어드민 라우터는 제품 라우터와 완전히 분리된 트리다. `/admin` 하위 경로는 이 라우터만
 * 처리하므로, 제품 라우터에 실수로 추가된 미들웨어가 어드민 요청에 섞이지 않는다.
 */
export type AdminRouteDependencies = SystemStatusHandlerDependencies;

export function createAdminRouter(dependencies: AdminRouteDependencies = {}): Router {
  const router = Router();
  router.use("/auth", adminAuthRouter);
  router.use("/dashboard", adminDashboardRouter);
  router.use("/system", createAdminSystemRouter(dependencies));
  router.use("/audit-logs", adminAuditLogRouter);
  router.use("/users", adminUserRouter);
  router.use("/workspaces", adminWorkspaceRouter);
  router.use("/projects", adminProjectRouter);
  router.use("/whiteboard-documents", adminWhiteboardDocumentRouter);
  return router;
}
