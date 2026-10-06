import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUsers } from "@/db/schema";
import { ERROR_MESSAGES } from "@/constants/messages";
import { HttpError } from "@/utils/http-error";

/*
 * `admin_users` 행 접근만 담당한다. 제품의 `user.service.ts`가 `users`에 대해 하는
 * 역할과 같다. 인증 흐름은 `admin-auth.service.ts`에 있다.
 */

export async function getAdminByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // 저장된 이메일이 어떤 케이스로 들어왔는지에 의존하지 않는다 — 부트스트랩 스크립트가
  // 소문자로 넣는다는 보장이 없다.
  return db.query.adminUsers.findFirst({
    where: sql`lower(${adminUsers.email}) = ${normalizedEmail}`,
  });
}

export async function getAdminById(id: string) {
  return db.query.adminUsers.findFirst({
    where: eq(adminUsers.id, id),
  });
}

export async function hasAdminUsers(): Promise<boolean> {
  return Boolean(await db.query.adminUsers.findFirst({ columns: { id: true } }));
}

export async function touchAdminLastLoginAt(adminId: string, loggedInAt: Date): Promise<void> {
  await db.update(adminUsers).set({ lastLoginAt: loggedInAt }).where(eq(adminUsers.id, adminId));
}

export interface CreateAdminUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

/*
 * `admin_users.email`의 unique 제약은 대소문자를 구분하는데 로그인 조회는 `lower()`로
 * 비교한다. 정규화 없이 넣으면 `Admin@x`와 `admin@x`가 공존하고 로그인이 둘 중 하나를
 * 임의로 고르게 되므로, 저장 전에 소문자로 맞추고 중복도 같은 기준으로 본다.
 */
export async function createAdminUser({ email, name, passwordHash }: CreateAdminUserInput) {
  const normalizedEmail = email.trim().toLowerCase();

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${normalizedEmail}`);

    if (existing) {
      throw new HttpError(409, "EMAIL_ALREADY_EXISTS", ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
    }

    const [admin] = await tx
      .insert(adminUsers)
      .values({ email: normalizedEmail, name, passwordHash })
      .onConflictDoNothing()
      .returning();

    // 사전 조회와 insert 사이에 같은 이메일이 들어온 경합. 제약이 막아준 결과도 중복이다.
    if (!admin) {
      throw new HttpError(409, "EMAIL_ALREADY_EXISTS", ERROR_MESSAGES.EMAIL_ALREADY_EXISTS);
    }

    return admin;
  });
}
