import type { Request, Response } from "express";
import { db } from "@/db/client";
import { hashPassword } from "@/lib/password";
import {
  adminUserListQuerySchema,
  adminUserParamsSchema,
  createUserSchema,
  deleteUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "@/schemas/admin-user.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import {
  createUser,
  deactivateUser,
  deleteUser,
  getUserDeletionImpact,
  getUserDetail,
  listUsers,
  reactivateUser,
  resetUserPassword,
  revokeUserSessions,
  updateUser,
} from "@/services/admin-user.service";
import { deleteAllRefreshSessions } from "@/services/session.service";
import { getAuditRequestContext } from "@/utils/audit-request";
import { logger } from "@/utils/logger";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireAdmin } from "@/utils/require-admin";

/*
 * 변경 핸들러는 트랜잭션을 직접 열고 서비스 호출과 감사 로그를 그 안에서 끝낸다.
 * 감사 로그를 서비스에 넣으면 제품 경로가 같은 서비스를 재사용할 때 어드민 로그가
 * 섞이고, 트랜잭션을 서비스에 넣으면 변경만 커밋되고 로그가 빠지는 상태가 생긴다.
 */

export async function listUsersHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { search, status, page, limit } = parseOrThrow(adminUserListQuerySchema, req.query);

  const result = await listUsers({ search, status, page, limit });

  res.status(200).json(result);
}

export async function createUserHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { email, name, password } = parseOrThrow(createUserSchema, req.body);

  // 해시는 트랜잭션 밖에서 계산한다. bcrypt가 도는 동안 커넥션을 잡고 있으면 다른 요청이 밀린다.
  const passwordHash = await hashPassword(password);

  const user = await db.transaction(async (tx) => {
    const createdUser = await createUser(tx, { email, name, passwordHash });

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "user.create",
      targetType: "user",
      targetId: createdUser.id,
      summary: `사용자 ${createdUser.email} 계정을 생성했습니다`,
      metadata: { email: createdUser.email, name: createdUser.name },
      ...getAuditRequestContext(req),
    });

    return createdUser;
  });

  res.status(201).json({ user });
}

export async function getUserDetailHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { userId } = parseOrThrow(adminUserParamsSchema, req.params);

  const detail = await getUserDetail(userId);

  res.status(200).json(detail);
}

export async function updateUserHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { userId } = parseOrThrow(adminUserParamsSchema, req.params);
  const { name, email } = parseOrThrow(updateUserSchema, req.body);

  const user = await db.transaction(async (tx) => {
    const { previousUser, user: updatedUser } = await updateUser(tx, { userId, name, email });

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "user.update",
      targetType: "user",
      targetId: updatedUser.id,
      summary: `사용자 ${updatedUser.email} 정보를 수정했습니다`,
      metadata: {
        before: { name: previousUser.name, email: previousUser.email },
        after: { name: updatedUser.name, email: updatedUser.email },
      },
      ...getAuditRequestContext(req),
    });

    return updatedUser;
  });

  res.status(200).json({ user });
}

/*
 * 세션 무효화의 실효는 `sessionVersion` 증가가 담당한다 — 남은 Valkey 키만으로는
 * refresh 갱신이 통과하지 않는다. 그래서 키 정리는 커밋 뒤에 하고, 실패해도 이미
 * 커밋된 변경을 500으로 뒤집지 않는다. 어드민이 성공한 변경을 실패로 읽는 게 더 나쁘다.
 */
async function deleteRefreshSessionsQuietly(userId: string) {
  try {
    await deleteAllRefreshSessions(userId);
  } catch (error) {
    logger.warn({ err: error, userId }, "Failed to delete refresh sessions after an admin change");
  }
}

export async function resetUserPasswordHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { userId } = parseOrThrow(adminUserParamsSchema, req.params);
  const { newPassword } = parseOrThrow(resetUserPasswordSchema, req.body);

  const passwordHash = await hashPassword(newPassword);

  const user = await db.transaction(async (tx) => {
    const { user: updatedUser } = await resetUserPassword(tx, { userId, passwordHash });

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "user.password-reset",
      targetType: "user",
      targetId: updatedUser.id,
      summary: `사용자 ${updatedUser.email} 비밀번호를 재설정했습니다`,
      /* 평문도 해시도 남기지 않는다. 감사 로그는 열람 권한이 더 넓다. */
      metadata: { passwordReset: true },
      ...getAuditRequestContext(req),
    });

    return updatedUser;
  });

  await deleteRefreshSessionsQuietly(user.id);

  res.status(200).json({ user });
}

export async function deactivateUserHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { userId } = parseOrThrow(adminUserParamsSchema, req.params);

  const user = await db.transaction(async (tx) => {
    const { previousUser, user: updatedUser } = await deactivateUser(tx, userId);

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "user.deactivate",
      targetType: "user",
      targetId: updatedUser.id,
      summary: `사용자 ${updatedUser.email} 계정을 정지했습니다`,
      metadata: {
        before: { deactivatedAt: previousUser.deactivatedAt?.toISOString() ?? null },
        after: { deactivatedAt: updatedUser.deactivatedAt?.toISOString() ?? null },
      },
      ...getAuditRequestContext(req),
    });

    return updatedUser;
  });

  await deleteRefreshSessionsQuietly(user.id);

  res.status(200).json({ user });
}

export async function reactivateUserHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { userId } = parseOrThrow(adminUserParamsSchema, req.params);

  const user = await db.transaction(async (tx) => {
    const { previousUser, user: updatedUser } = await reactivateUser(tx, userId);

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "user.reactivate",
      targetType: "user",
      targetId: updatedUser.id,
      summary: `사용자 ${updatedUser.email} 계정 정지를 해제했습니다`,
      metadata: {
        before: { deactivatedAt: previousUser.deactivatedAt?.toISOString() ?? null },
        after: { deactivatedAt: updatedUser.deactivatedAt?.toISOString() ?? null },
      },
      ...getAuditRequestContext(req),
    });

    return updatedUser;
  });

  res.status(200).json({ user });
}

export async function revokeUserSessionsHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { userId } = parseOrThrow(adminUserParamsSchema, req.params);

  const user = await db.transaction(async (tx) => {
    const { user: updatedUser } = await revokeUserSessions(tx, userId);

    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "user.sessions-revoke",
      targetType: "user",
      targetId: updatedUser.id,
      summary: `사용자 ${updatedUser.email} 세션을 모두 종료했습니다`,
      metadata: { sessionsRevoked: true },
      ...getAuditRequestContext(req),
    });

    return updatedUser;
  });

  await deleteRefreshSessionsQuietly(user.id);

  res.status(200).json({ user });
}

export async function getUserDeletionImpactHandler(req: Request, res: Response) {
  requireAdmin(req);
  const { userId } = parseOrThrow(adminUserParamsSchema, req.params);

  const impact = await getUserDeletionImpact(userId);

  res.status(200).json(impact);
}

export async function deleteUserHandler(req: Request, res: Response) {
  const admin = requireAdmin(req);
  const { userId } = parseOrThrow(adminUserParamsSchema, req.params);
  const { email } = parseOrThrow(deleteUserSchema, req.body);

  const deletedUser = await db.transaction(async (tx) => {
    const user = await deleteUser(tx, { userId, confirmationEmail: email });

    /*
     * 사용자 행이 사라지므로 감사 로그의 `targetId`는 더 이상 조회되지 않는다.
     * 누가 무엇을 지웠는지 남는 유일한 흔적이라 이메일과 이름을 함께 기록한다.
     */
    await recordAuditLog(tx, {
      adminId: admin.sub,
      action: "user.delete",
      targetType: "user",
      targetId: user.id,
      summary: `사용자 ${user.email} 계정을 삭제했습니다`,
      metadata: { before: { email: user.email, name: user.name } },
      ...getAuditRequestContext(req),
    });

    return user;
  });

  await deleteRefreshSessionsQuietly(deletedUser.id);

  res.status(204).send();
}
