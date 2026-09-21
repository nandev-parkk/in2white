import { createApplicationServer } from "@/server-app";
import { closeValkey } from "@/cache/valkey";
import { getEnv } from "@/config/env";
import { closeDatabase } from "@/db/client";
import { createApplicationShutdown } from "@/server-shutdown";
import { logger } from "@/utils/logger";

const env = getEnv();
let shutdownDeadlineAt = Number.POSITIVE_INFINITY;
const { httpServer, collaboration } = createApplicationServer(() => shutdownDeadlineAt);

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
