import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { adminUsers } from "@/db/schema";

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

export async function touchAdminLastLoginAt(adminId: string, loggedInAt: Date): Promise<void> {
  await db.update(adminUsers).set({ lastLoginAt: loggedInAt }).where(eq(adminUsers.id, adminId));
}
