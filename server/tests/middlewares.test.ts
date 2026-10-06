import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { notFoundMiddleware } from "@/middlewares/not-found.middleware";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";
import { rateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { HttpError } from "@/utils/http-error";

function createMockResponse() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("notFoundMiddleware", () => {
  it("responds with 404 and route info", () => {
    const req = { method: "GET", originalUrl: "/unknown" } as Request;
    const res = createMockResponse();

    notFoundMiddleware(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "Route not found: GET /unknown", code: "NOT_FOUND" },
    });
  });
});

describe("errorHandlerMiddleware", () => {
  it("responds with 500 and a generic message, not the internal error detail", () => {
    const res = createMockResponse();

    errorHandlerMiddleware(new Error("boom"), {} as Request, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  });
});

describe("errorHandlerMiddleware with HttpError", () => {
  it("responds with the HttpError's own status and code", () => {
    const res = createMockResponse();

    errorHandlerMiddleware(
      new HttpError(401, "INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다"),
      {} as Request,
      res,
      vi.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: "이메일 또는 비밀번호가 올바르지 않습니다", code: "INVALID_CREDENTIALS" },
    });
  });
});

describe("rateLimitMiddleware", () => {
  it("is an express middleware function", () => {
    expect(typeof rateLimitMiddleware).toBe("function");
  });
});
