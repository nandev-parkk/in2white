import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaceMemberships, workspaces } from "@/db/schema";

const DEFAULT_WORKSPACE_NAME = "My Workspace";

export interface UpsertUserWithDefaultWorkspaceInput {
  email: string;
  name: string;
  passwordHash: string;
}

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

export async function updateUserName({ userId, name }: { userId: string; name: string }) {
  const [user] = await db.update(users).set({ name }).where(eq(users.id, userId)).returning();
  return user;
}

export async function updateUserPasswordAndIncrementSessionVersion({
  userId,
  passwordHash,
}: {
  userId: string;
  passwordHash: string;
}) {
  const [user] = await db
    .update(users)
    .set({
      passwordHash,
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.id, userId))
    .returning();
  return user;
}

export async function upsertUserWithDefaultWorkspace({
  email,
  name,
  passwordHash,
}: UpsertUserWithDefaultWorkspaceInput) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, name, passwordHash })
      .onConflictDoUpdate({
        target: users.email,
        set: { name, passwordHash },
      })
      .returning();

    if (!user) {
      throw new Error("User upsert returned no row");
    }

    const [existingDefaultWorkspace] = await tx
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.ownerId, user.id), eq(workspaces.isDefault, true)));

    let defaultWorkspace = existingDefaultWorkspace;

    if (!defaultWorkspace) {
      const [createdDefaultWorkspace] = await tx
        .insert(workspaces)
        .values({
          name: DEFAULT_WORKSPACE_NAME,
          ownerId: user.id,
          isDefault: true,
        })
        .returning();

      if (!createdDefaultWorkspace) {
        throw new Error("Default workspace insert returned no row");
      }

      defaultWorkspace = createdDefaultWorkspace;
    }

    await tx
      .insert(workspaceMemberships)
      .values({
        workspaceId: defaultWorkspace.id,
        userId: user.id,
        role: "owner",
      })
      .onConflictDoUpdate({
        target: [workspaceMemberships.workspaceId, workspaceMemberships.userId],
        set: { role: "owner" },
      });

    return user;
  });
}
