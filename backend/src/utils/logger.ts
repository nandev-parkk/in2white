import pino from "pino";
import { getEnv } from "@/config/env";

const isDevelopment = getEnv().NODE_ENV === "development";

export const logger = pino({
  level: getEnv().NODE_ENV === "production" ? "info" : "debug",
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
        },
      }
    : undefined,
});
