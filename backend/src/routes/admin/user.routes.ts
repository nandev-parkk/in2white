import { Router } from "express";
import {
  createUserHandler,
  deactivateUserHandler,
  getUserDetailHandler,
  listUsersHandler,
  reactivateUserHandler,
  resetUserPasswordHandler,
  revokeUserSessionsHandler,
  updateUserHandler,
} from "@/controllers/admin-user.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const adminUserRouter = Router();

/* 라우터 전체에 한 번 건다. 엔드포인트마다 붙이면 하나를 빠뜨렸을 때 조용히 열린다. */
adminUserRouter.use(authenticateAdmin);

adminUserRouter.get("/", asyncHandler(listUsersHandler));
adminUserRouter.post("/", asyncHandler(createUserHandler));
adminUserRouter.get("/:userId", asyncHandler(getUserDetailHandler));
adminUserRouter.patch("/:userId", asyncHandler(updateUserHandler));

/* 상태 변경은 GET과 구분되게 POST로 둔다 — 링크 클릭이나 프리페치로 실행되면 안 된다. */
adminUserRouter.post("/:userId/password", asyncHandler(resetUserPasswordHandler));
adminUserRouter.post("/:userId/deactivate", asyncHandler(deactivateUserHandler));
adminUserRouter.post("/:userId/reactivate", asyncHandler(reactivateUserHandler));
adminUserRouter.post("/:userId/sessions/revoke", asyncHandler(revokeUserSessionsHandler));
