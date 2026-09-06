import type { NextFunction, Request, Response } from "express";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";

export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  logger.error({ err }, "Unhandled error");

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { message: err.message, code: err.code },
    });
    return;
  }

  const message = err instanceof Error ? err.message : "Internal server error";

  res.status(500).json({
    error: {
      message,
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}
