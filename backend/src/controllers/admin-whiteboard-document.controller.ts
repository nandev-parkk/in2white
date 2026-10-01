import type { Request, Response } from "express";
import { db } from "@/db/client";
import {
  adminWhiteboardDocumentListQuerySchema,
  adminWhiteboardDocumentParamsSchema,
} from "@/schemas/admin-whiteboard-document.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import {
  deleteWhiteboardDocument,
  listWhiteboardDocuments,
  restoreWhiteboardDocument,
} from "@/services/admin-whiteboard-document.service";
import { getAuditRequestContext } from "@/utils/audit-request";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireAdmin } from "@/utils/require-admin";

/*
 * 프로젝트 컨트롤러와 같은 구조다 — 변경 핸들러가 트랜잭션을 열고 서비스 호출과 감사 로그를
 * 그 안에서 끝낸다. 조회 핸들러는 트랜잭션도 감사 로그도 쓰지 않는다.
 */

export async function listWhiteboardDocumentsHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { projectId, search, status, page, limit } = parseOrThrow(
    adminWhiteboardDocumentListQuerySchema,
    req.query,
  );

  const result = await listWhiteboardDocuments({ projectId, search, status, page, limit });

  res.status(200).json(result);
}

export async function deleteWhiteboardDocumentHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { documentId } = parseOrThrow(adminWhiteboardDocumentParamsSchema, req.params);

  await db.transaction(async (tx) => {
    const document = await deleteWhiteboardDocument(tx, documentId);

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "whiteboard-document.delete",
      targetType: "whiteboard_document",
      targetId: document.id,
      summary: `화이트보드 문서 ${document.name}을 삭제했습니다`,
      /* 복구 가능한 삭제다. 목록에서 대상을 다시 찾을 수 있을 만큼만 남긴다. */
      metadata: {
        before: {
          name: document.name,
          projectId: document.project.id,
          projectName: document.project.name,
        },
      },
      ...getAuditRequestContext(req),
    });
  });

  res.status(204).send();
}

export async function restoreWhiteboardDocumentHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { documentId } = parseOrThrow(adminWhiteboardDocumentParamsSchema, req.params);

  const whiteboardDocument = await db.transaction(async (tx) => {
    const restored = await restoreWhiteboardDocument(tx, documentId);

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "whiteboard-document.restore",
      targetType: "whiteboard_document",
      targetId: restored.id,
      summary: `화이트보드 문서 ${restored.name}을 복구했습니다`,
      metadata: {
        after: {
          name: restored.name,
          projectId: restored.project.id,
          projectName: restored.project.name,
        },
      },
      ...getAuditRequestContext(req),
    });

    return restored;
  });

  res.status(200).json({ whiteboardDocument });
}
