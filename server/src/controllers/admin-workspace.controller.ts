import type { Request, Response } from "express";
import { db } from "@/db/client";
import {
  addWorkspaceMemberSchema,
  adminWorkspaceListQuerySchema,
  adminWorkspaceMemberParamsSchema,
  adminWorkspaceParamsSchema,
  transferWorkspaceOwnerSchema,
  updateWorkspaceSchema,
} from "@/schemas/admin-workspace.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import {
  addWorkspaceMember,
  deleteWorkspace,
  getWorkspaceDetail,
  listWorkspaces,
  removeWorkspaceMember,
  transferWorkspaceOwner,
  updateWorkspace,
} from "@/services/admin-workspace.service";
import { getAuditRequestContext } from "@/utils/audit-request";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireAdmin } from "@/utils/require-admin";

/*
 * 사용자 컨트롤러와 같은 구조다 — 변경 핸들러가 트랜잭션을 열고 서비스 호출과 감사 로그를
 * 그 안에서 끝낸다. 조회 핸들러는 트랜잭션도 감사 로그도 쓰지 않는다.
 */

export async function listWorkspacesHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { search, page, limit } = parseOrThrow(adminWorkspaceListQuerySchema, req.query);

  const result = await listWorkspaces({ search, page, limit });

  res.status(200).json(result);
}

export async function getWorkspaceDetailHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { workspaceId } = parseOrThrow(adminWorkspaceParamsSchema, req.params);

  const detail = await getWorkspaceDetail(workspaceId);

  res.status(200).json(detail);
}

export async function updateWorkspaceHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { workspaceId } = parseOrThrow(adminWorkspaceParamsSchema, req.params);
  const { name } = parseOrThrow(updateWorkspaceSchema, req.body);

  const workspace = await db.transaction(async (tx) => {
    const { previousWorkspace, workspace: updatedWorkspace } = await updateWorkspace(tx, {
      workspaceId,
      name,
    });

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "workspace.update",
      targetType: "workspace",
      targetId: updatedWorkspace.id,
      summary: `워크스페이스 ${previousWorkspace.name} 이름을 ${updatedWorkspace.name}으로 변경했습니다`,
      metadata: {
        before: { name: previousWorkspace.name },
        after: { name: updatedWorkspace.name },
      },
      ...getAuditRequestContext(req),
    });

    return updatedWorkspace;
  });

  res.status(200).json({ workspace });
}

export async function transferWorkspaceOwnerHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { workspaceId } = parseOrThrow(adminWorkspaceParamsSchema, req.params);
  const { userId } = parseOrThrow(transferWorkspaceOwnerSchema, req.body);

  const result = await db.transaction(async (tx) => {
    const transfer = await transferWorkspaceOwner(tx, { workspaceId, userId });

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "workspace.transfer-owner",
      targetType: "workspace",
      targetId: transfer.workspace.id,
      summary: `워크스페이스 ${transfer.workspace.name} 소유자를 ${transfer.newOwner.email}로 이전했습니다`,
      /* 이전 소유자를 남겨야 되돌릴 대상을 알 수 있다. */
      metadata: {
        before: { ownerId: transfer.previousOwner.id, ownerEmail: transfer.previousOwner.email },
        after: { ownerId: transfer.newOwner.id, ownerEmail: transfer.newOwner.email },
      },
      ...getAuditRequestContext(req),
    });

    return transfer;
  });

  res.status(200).json({ workspace: result.workspace, owner: result.newOwner });
}

export async function addWorkspaceMemberHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { workspaceId } = parseOrThrow(adminWorkspaceParamsSchema, req.params);
  const { userId } = parseOrThrow(addWorkspaceMemberSchema, req.body);

  const member = await db.transaction(async (tx) => {
    const result = await addWorkspaceMember(tx, { workspaceId, userId });

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "workspace.member-add",
      /*
       * 대상은 워크스페이스다. 멤버십 id는 화면에서 조회할 수 없어 로그만 남으면
       * 어느 워크스페이스의 변경인지 추적할 수 없다.
       */
      targetType: "workspace",
      targetId: result.workspace.id,
      summary: `워크스페이스 ${result.workspace.name}에 멤버 ${result.member.email}을 추가했습니다`,
      metadata: {
        member: {
          userId: result.member.userId,
          email: result.member.email,
          role: result.member.role,
        },
      },
      ...getAuditRequestContext(req),
    });

    return result.member;
  });

  res.status(201).json({ member });
}

export async function removeWorkspaceMemberHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { workspaceId, userId } = parseOrThrow(adminWorkspaceMemberParamsSchema, req.params);

  await db.transaction(async (tx) => {
    const result = await removeWorkspaceMember(tx, { workspaceId, userId });

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "workspace.member-remove",
      targetType: "workspace",
      targetId: result.workspace.id,
      summary: `워크스페이스 ${result.workspace.name}에서 멤버 ${result.member.email}을 제거했습니다`,
      /* 멤버십 행이 사라지므로 누구를 뺐는지 남는 유일한 흔적이다. */
      metadata: {
        before: {
          member: {
            userId: result.member.userId,
            email: result.member.email,
            role: result.member.role,
          },
        },
      },
      ...getAuditRequestContext(req),
    });
  });

  res.status(204).send();
}

export async function deleteWorkspaceHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { workspaceId } = parseOrThrow(adminWorkspaceParamsSchema, req.params);

  await db.transaction(async (tx) => {
    const workspace = await deleteWorkspace(tx, workspaceId);

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "workspace.delete",
      targetType: "workspace",
      targetId: workspace.id,
      summary: `워크스페이스 ${workspace.name}을 삭제했습니다`,
      /* 워크스페이스 행이 사라져 `targetId`로는 아무것도 조회되지 않는다. */
      metadata: {
        before: {
          name: workspace.name,
          ownerId: workspace.owner.id,
          ownerEmail: workspace.owner.email,
        },
      },
      ...getAuditRequestContext(req),
    });
  });

  res.status(204).send();
}
