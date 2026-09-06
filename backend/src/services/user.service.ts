import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";

export async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  return db.query.users.findFirst({
    where: eq(users.email, normalizedEmail),
  });
}

export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
  });
}
