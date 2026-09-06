import type { NextFunction, Request, Response } from "express";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";

export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    logger.warn({ status: err.status, code: err.code }, "Request error");
    res.status(err.status).json({
      error: { message: err.message, code: err.code },
    });
    return;
  }

  logger.error({ err }, "Unhandled error");

  const message = err instanceof Error ? err.message : "Internal server error";

  res.status(500).json({
    error: {
      message,
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}
