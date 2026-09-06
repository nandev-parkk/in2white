import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { getEnv } from "@/config/env";
import { router } from "@/routes/index";
import { rateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { notFoundMiddleware } from "@/middlewares/not-found.middleware";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";
import { logger } from "@/utils/logger";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: getEnv().CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      redact: ["req.headers.authorization", "req.headers.cookie"],
    }),
  );
  app.use(rateLimitMiddleware);

  app.use(router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
