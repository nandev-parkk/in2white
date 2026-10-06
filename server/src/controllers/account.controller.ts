import type { Request, Response } from "express";
import { changePasswordSchema, updateAccountSchema } from "@/schemas/account.schema";
import { changeAccountPassword, getAccount, updateAccount } from "@/services/account.service";
import { clearRefreshTokenCookie, setRefreshTokenCookie } from "@/utils/auth-cookie";
import { parseOrThrow } from "@/utils/parse-or-throw";
import { requireUser } from "@/utils/require-user";
import { HttpError } from "@/utils/http-error";

export async function getAccountHandler(req: Request, res: Response) {
  const user = requireUser(req);
  res.status(200).json({ user: await getAccount(user.sub) });
}

export async function updateAccountHandler(req: Request, res: Response) {
  const authUser = requireUser(req);
  const input = parseOrThrow(updateAccountSchema, req.body);
  const user = await updateAccount({ userId: authUser.sub, name: input.name });
  res.status(200).json({ user });
}

export async function changeAccountPasswordHandler(req: Request, res: Response) {
  const authUser = requireUser(req);
  const input = parseOrThrow(changePasswordSchema, req.body);

  try {
    const result = await changeAccountPassword({ userId: authUser.sub, ...input });
    setRefreshTokenCookie(res, result.refreshToken);
    res.status(200).json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    if (err instanceof HttpError && err.code === "PASSWORD_CHANGED_REAUTH_REQUIRED") {
      clearRefreshTokenCookie(res);
    }
    throw err;
  }
}
