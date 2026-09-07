import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/lib/jwt";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      error: { message: "인증 토큰이 필요합니다", code: "UNAUTHORIZED" },
    });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = await verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: { message: "유효하지 않거나 만료된 토큰입니다", code: "UNAUTHORIZED" },
    });
  }
}
