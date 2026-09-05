import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "@/lib/jwt";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({
      error: { message: "Missing bearer token", code: "UNAUTHORIZED" },
    });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = await verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({
      error: { message: "Invalid or expired token", code: "UNAUTHORIZED" },
    });
  }
}
