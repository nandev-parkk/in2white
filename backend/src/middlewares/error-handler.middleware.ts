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

  // 예상하지 못한 에러의 실제 원인(err.message)은 서버 로그에만 남기고,
  // 클라이언트에는 내부 구현이 드러나지 않는 고정 메시지만 응답한다.
  res.status(500).json({
    error: {
      message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요",
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}
