import type { Request } from "express";
import { ERROR_MESSAGES } from "@/constants/messages";
import { HttpError } from "@/utils/http-error";

export function requireUser(req: Request) {
  if (!req.user) {
    throw new HttpError(401, "UNAUTHORIZED", ERROR_MESSAGES.MISSING_BEARER_TOKEN);
  }

  return req.user;
}
