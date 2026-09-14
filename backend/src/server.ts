import { createServer } from "node:http";
import { createApp } from "@/app";
import { closeValkey } from "@/cache/valkey";
import { getEnv } from "@/config/env";
import { closeDatabase } from "@/db/client";
import { createWhiteboardCollaborationServer } from "@/realtime/whiteboard-collaboration";
import { createApplicationShutdown } from "@/server-shutdown";
import { logger } from "@/utils/logger";

const env = getEnv();
const httpServer = createServer();
let shutdownDeadlineAt = Number.POSITIVE_INFINITY;
const collaboration = createWhiteboardCollaborationServer(httpServer, {
  shutdownDeadlineAt: () => shutdownDeadlineAt,
});
const app = createApp({
  onWhiteboardDocumentDeleted: collaboration.documentDeleted,
});
httpServer.on("request", app);

const shutdown = createApplicationShutdown({
  closeCollaboration: collaboration.close,
  closeDatabase,
  closeValkey,
  logger,
  onDeadlineCreated: (deadlineAt) => {
    shutdownDeadlineAt = deadlineAt;
  },
});

httpServer.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
