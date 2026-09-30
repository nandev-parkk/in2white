import type { Request, Response } from "express";
import { db } from "@/db/client";
import { hashPassword } from "@/lib/password";
import { adminUserListQuerySchema, createUserSchema } from "@/schemas/admin-user.schema";
import { recordAuditLog } from "@/services/admin-audit-log.service";
import { createUser, listUsers } from "@/services/admin-user.service";
import { getAuditRequestContext } from "@/utils/audit-request";
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
