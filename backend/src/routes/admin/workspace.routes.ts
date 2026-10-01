import { Router } from "express";
import {
  addWorkspaceMemberHandler,
  deleteWorkspaceHandler,
  getWorkspaceDetailHandler,
  listWorkspacesHandler,
  removeWorkspaceMemberHandler,
  transferWorkspaceOwnerHandler,
  updateWorkspaceHandler,
} from "@/controllers/admin-workspace.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const adminWorkspaceRouter = Router();

/* 라우터 전체에 한 번 건다. 엔드포인트마다 붙이면 하나를 빠뜨렸을 때 조용히 열린다. */
adminWorkspaceRouter.use(authenticateAdmin);

adminWorkspaceRouter.get("/", asyncHandler(listWorkspacesHandler));
adminWorkspaceRouter.get("/:workspaceId", asyncHandler(getWorkspaceDetailHandler));
adminWorkspaceRouter.patch("/:workspaceId", asyncHandler(updateWorkspaceHandler));

/* 소유자 이전은 상태 변경이라 POST다 — 링크 클릭이나 프리페치로 실행되면 안 된다. */
adminWorkspaceRouter.post(
  "/:workspaceId/transfer-owner",
  asyncHandler(transferWorkspaceOwnerHandler),
);

adminWorkspaceRouter.post("/:workspaceId/members", asyncHandler(addWorkspaceMemberHandler));
adminWorkspaceRouter.delete(
  "/:workspaceId/members/:userId",
  asyncHandler(removeWorkspaceMemberHandler),
);
adminWorkspaceRouter.delete("/:workspaceId", asyncHandler(deleteWorkspaceHandler));
