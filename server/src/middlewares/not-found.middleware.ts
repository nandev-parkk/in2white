import type { NextFunction, Request, Response } from "express";

export function notFoundMiddleware(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      code: "NOT_FOUND",
    },
  });
}
