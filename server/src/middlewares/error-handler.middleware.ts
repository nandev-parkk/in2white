import type { NextFunction, Request, Response } from "express";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";
import { ERROR_MESSAGES } from "@/constants/messages";

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

  // 예상하지 못한 에러의 실제 원인(err.message)은 서버 로그에만 남기고,
  // 클라이언트에는 내부 구현이 드러나지 않는 고정 메시지만 응답한다.
  res.status(500).json({
    error: {
      message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}
