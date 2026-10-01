import type { NextFunction, Request, Response } from "express";
import { verifyAdminAccessToken } from "@/lib/admin-jwt";
import { ERROR_MESSAGES } from "@/constants/messages";

/*
 * `req.admin`에만 채우고 `req.user`는 건드리지 않는다. 두 곳을 모두 채우면 제품
 * 컨트롤러가 어드민 요청을 일반 사용자 요청으로 착각해 처리할 수 있다.
 */
export async function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      error: { message: ERROR_MESSAGES.MISSING_BEARER_TOKEN, code: "UNAUTHORIZED" },
    });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    req.admin = await verifyAdminAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: { message: ERROR_MESSAGES.INVALID_ACCESS_TOKEN, code: "UNAUTHORIZED" },
    });
  }
}
