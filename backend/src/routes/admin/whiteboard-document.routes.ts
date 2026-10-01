import { Router } from "express";
import {
  deleteWhiteboardDocumentHandler,
  listWhiteboardDocumentsHandler,
  restoreWhiteboardDocumentHandler,
} from "@/controllers/admin-whiteboard-document.controller";
import { authenticateAdmin } from "@/middlewares/admin-auth.middleware";
import { asyncHandler } from "@/utils/async-handler";

export const adminWhiteboardDocumentRouter = Router();

/* 라우터 전체에 한 번 건다. 엔드포인트마다 붙이면 하나를 빠뜨렸을 때 조용히 열린다. */
adminWhiteboardDocumentRouter.use(authenticateAdmin);

adminWhiteboardDocumentRouter.get("/", asyncHandler(listWhiteboardDocumentsHandler));
adminWhiteboardDocumentRouter.delete("/:documentId", asyncHandler(deleteWhiteboardDocumentHandler));

/* 복구는 상태 변경이라 POST다 — 링크 클릭이나 프리페치로 실행되면 안 된다. */
adminWhiteboardDocumentRouter.post(
  "/:documentId/restore",
  asyncHandler(restoreWhiteboardDocumentHandler),
);
