import type { Request, Response } from "express";
import { db } from "@/db/client";
import {
  adminProjectListQuerySchema,
  adminProjectParamsSchema,
} from "@/schemas/admin-project.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import {
  deleteProject,
  getProjectDetail,
  listProjects,
  restoreProject,
} from "@/services/admin-project.service";
import { getAuditRequestContext } from "@/utils/audit-request";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireAdmin } from "@/utils/require-admin";

/*
 * 사용자·워크스페이스 컨트롤러와 같은 구조다 — 변경 핸들러가 트랜잭션을 열고 서비스 호출과
 * 감사 로그를 그 안에서 끝낸다. 조회 핸들러는 트랜잭션도 감사 로그도 쓰지 않는다.
 */

export async function listProjectsHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { workspaceId, search, status, page, limit } = parseOrThrow(
    adminProjectListQuerySchema,
    req.query,
  );

  const result = await listProjects({ workspaceId, search, status, page, limit });

  res.status(200).json(result);
}

export async function getProjectDetailHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { projectId } = parseOrThrow(adminProjectParamsSchema, req.params);

  const detail = await getProjectDetail(projectId);

  res.status(200).json(detail);
}

export async function deleteProjectHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { projectId } = parseOrThrow(adminProjectParamsSchema, req.params);

  await db.transaction(async (tx) => {
    const project = await deleteProject(tx, projectId);

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "project.delete",
      targetType: "project",
      targetId: project.id,
      summary: `프로젝트 ${project.name}을 삭제했습니다`,
      /* 복구 가능한 삭제다. 목록에서 대상을 다시 찾을 수 있을 만큼만 남긴다. */
      metadata: {
        before: {
          name: project.name,
          workspaceId: project.workspace.id,
          workspaceName: project.workspace.name,
        },
      },
      ...getAuditRequestContext(req),
    });
  });

  res.status(204).send();
}

export async function restoreProjectHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { projectId } = parseOrThrow(adminProjectParamsSchema, req.params);

  const project = await db.transaction(async (tx) => {
    const restored = await restoreProject(tx, projectId);

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "project.restore",
      targetType: "project",
      targetId: restored.id,
      summary: `프로젝트 ${restored.name}을 복구했습니다`,
      metadata: {
        after: {
          name: restored.name,
          workspaceId: restored.workspace.id,
          workspaceName: restored.workspace.name,
        },
      },
      ...getAuditRequestContext(req),
    });

    return restored;
  });

  res.status(200).json({ project });
}
