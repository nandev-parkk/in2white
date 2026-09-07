import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/lib/jwt";
import { ERROR_MESSAGES } from "@/constants/messages";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      error: { message: ERROR_MESSAGES.MISSING_BEARER_TOKEN, code: "UNAUTHORIZED" },
    });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = await verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: { message: ERROR_MESSAGES.INVALID_ACCESS_TOKEN, code: "UNAUTHORIZED" },
    });
  }
}
