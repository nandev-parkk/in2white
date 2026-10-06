import { Router } from "express";
import { listAuditLogsHandler } from "@/controllers/admin-audit-log.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { adminApiRateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const adminAuditLogRouter = Router();

adminAuditLogRouter.use(authenticateAdmin, adminApiRateLimitMiddleware);

adminAuditLogRouter.get("/", asyncHandler(listAuditLogsHandler));
