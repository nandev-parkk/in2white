import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // 대소문자를 매번 비교 시점에 맞춘다 — 저장된 이메일이 어떤 케이스로
  // 들어왔는지(관리자 도구가 소문자로 저장한다는 보장이 없음)에 의존하지 않는다.
  return db.query.users.findFirst({
    where: sql`lower(${users.email}) = ${normalizedEmail}`,
  });
}

export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}
