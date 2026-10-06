import { Router } from "express";
import { listAuditLogsHandler } from "@/controllers/admin-audit-log.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const adminAuditLogRouter = Router();

adminAuditLogRouter.use(authenticateAdmin);

adminAuditLogRouter.get("/", asyncHandler(listAuditLogsHandler));
