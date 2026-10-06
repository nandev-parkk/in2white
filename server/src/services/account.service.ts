import { randomUUID } from "node:crypto";
import { ERROR_MESSAGES } from "@/constants/messages";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { comparePassword, hashPassword } from "@/lib/password";
import { deleteOtherRefreshSessions, saveRefreshSession } from "@/services/session.service";
import {
  getUserById,
  updateUserName,
  updateUserPasswordAndIncrementSessionVersion,
} from "@/services/user.service";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";

export interface AccountUser {
  id: string;
  name: string;
  email: string;
}

export interface ChangeAccountPasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface UpdateAccountInput {
  userId: string;
  name: string;
}

export interface ChangeAccountPasswordResult {
  accessToken: string;
  refreshToken: string;
  user: AccountUser;
}

function accountNotFound(): HttpError {
  return new HttpError(404, "ACCOUNT_NOT_FOUND", ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
}

function toAccountUser(user: { id: string; name: string; email: string }): AccountUser {
  return { id: user.id, name: user.name, email: user.email };
}

export async function getAccount(userId: string): Promise<AccountUser> {
  const user = await getUserById(userId);
  if (!user) {
    throw accountNotFound();
  }

  return toAccountUser(user);
}

export async function updateAccount({ userId, name }: UpdateAccountInput): Promise<AccountUser> {
  const user = await updateUserName({ userId, name });
  if (!user) {
    throw accountNotFound();
  }

  return toAccountUser(user);
}

export async function changeAccountPassword({
  userId,
  currentPassword,
  newPassword,
}: ChangeAccountPasswordInput): Promise<ChangeAccountPasswordResult> {
  const user = await getUserById(userId);
  if (!user) {
    throw accountNotFound();
  }

  const matches = await comparePassword(currentPassword, user.passwordHash);
  if (!matches) {
    throw new HttpError(400, "CURRENT_PASSWORD_MISMATCH", ERROR_MESSAGES.CURRENT_PASSWORD_MISMATCH);
  }

  const passwordHash = await hashPassword(newPassword);
  const updated = await updateUserPasswordAndIncrementSessionVersion({ userId, passwordHash });
  if (!updated) {
    throw accountNotFound();
  }

  const sid = randomUUID();
  let tokenResult: [string, string] | undefined;
  try {
    tokenResult = await Promise.all([
      signAccessToken({
        sub: updated.id,
        email: updated.email,
        sid,
        ver: updated.sessionVersion,
      }),
      signRefreshToken({ sub: updated.id, sid, ver: updated.sessionVersion }),
    ]);
    await saveRefreshSession(updated.id, sid, tokenResult[1]);
  } catch (err) {
    logger.error({ err }, "Current session transition failed after password change");
    throw new HttpError(
      503,
      "PASSWORD_CHANGED_REAUTH_REQUIRED",
      ERROR_MESSAGES.PASSWORD_CHANGED_REAUTH_REQUIRED,
    );
  }

  try {
    await deleteOtherRefreshSessions(updated.id, sid);
  } catch (err) {
    logger.warn({ err }, "Old refresh session cleanup failed after password change");
  }

  const [accessToken, refreshToken] = tokenResult;
  return {
    accessToken,
    refreshToken,
    user: toAccountUser(updated),
  };
}
