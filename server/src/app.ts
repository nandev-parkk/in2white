import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { getEnv } from "@/config/env";
import type { WhiteboardRealtimeStats } from "@/realtime/whiteboard-room-manager";
import { createRouter } from "@/routes/index";
import { createAdminRouter } from "@/routes/admin/index";
import { rateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { notFoundMiddleware } from "@/middlewares/not-found.middleware";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";
import { logger } from "@/utils/logger";

export interface AppOptions {
  onWhiteboardDocumentDeleted?: (documentId: string) => void;
  /*
   * 실시간 통계는 소켓 서버가 가지고 있지만 이 앱이 소켓 서버보다 먼저 만들어진다.
   * 값 대신 호출 시점에 읽는 함수를 받아, 운영 상태 조회가 그 순간의 수를 보게 한다.
   */
  whiteboardRealtimeStats?: () => WhiteboardRealtimeStats;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  app.use(helmet());
  /*
   * 어드민 콘솔과 제품 프런트엔드는 서로 다른 origin에서 돌아간다. `cors`는 origin이
   * 문자열이면 비교 없이 그대로 헤더에 넣기 때문에 `app.use(cors(...))`를 두 번 쌓으면
   * 뒤쪽이 앞쪽을 덮어쓴다. 그래서 요청 경로를 보고 origin을 고르는 delegate를 쓴다.
   * 또한 이 미들웨어는 rate limit보다 앞에 있어야 한다. 뒤에 두면 429 응답에 CORS
   * 헤더가 붙지 않아 브라우저가 본문을 읽지 못하고 원인 불명의 네트워크 오류로 보인다.
   */
  app.use(
    cors((req, callback) => {
      const isAdminRequest = req.path.startsWith("/admin");
      callback(null, {
        origin: isAdminRequest ? getEnv().ADMIN_CORS_ORIGIN : getEnv().CORS_ORIGIN,
        credentials: true,
      });
    }),
  );
  app.use(compression());
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      redact: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
    }),
  );
  app.use(rateLimitMiddleware);

  app.use("/admin", createAdminRouter({ realtimeStats: options.whiteboardRealtimeStats }));

  app.use(
    createRouter({
      onDocumentDeleted: options.onWhiteboardDocumentDeleted,
    }),
  );

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
