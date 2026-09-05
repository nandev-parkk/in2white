import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { router } from "@/routes/index";
import { rateLimitMiddleware } from "@/middlewares/rate-limit.middleware";
import { notFoundMiddleware } from "@/middlewares/not-found.middleware";
import { errorHandlerMiddleware } from "@/middlewares/error-handler.middleware";
import { logger } from "@/utils/logger";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(rateLimitMiddleware);

  app.use(router);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
