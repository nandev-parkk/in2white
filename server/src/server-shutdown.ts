const DEFAULT_SHUTDOWN_DEADLINE_MS = 20_000;

interface ShutdownLogger {
  info: (details: Record<string, unknown>, message: string) => void;
  error: (details: Record<string, unknown>, message: string) => void;
}

export interface ApplicationShutdownDependencies {
  closeCollaboration: () => Promise<void>;
  closeDatabase: () => Promise<void>;
  closeValkey: () => Promise<void>;
  logger: ShutdownLogger;
  now?: () => number;
  deadlineMs?: number;
  onDeadlineCreated?: (deadlineAt: number) => void;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
}

class ShutdownDeadlineError extends Error {
  constructor(readonly step: string) {
    super(`Shutdown deadline exceeded during ${step}`);
    this.name = "ShutdownDeadlineError";
  }
}

export function createApplicationShutdown(dependencies: ApplicationShutdownDependencies) {
  const now = dependencies.now ?? Date.now;
  const deadlineMs = dependencies.deadlineMs ?? DEFAULT_SHUTDOWN_DEADLINE_MS;
  const setTimeoutFn = dependencies.setTimeout ?? setTimeout;
  const clearTimeoutFn = dependencies.clearTimeout ?? clearTimeout;
  let shutdownPromise: Promise<void> | undefined;

  return function shutdown(signal: string): Promise<void> {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    const deadlineAt = now() + deadlineMs;
    dependencies.onDeadlineCreated?.(deadlineAt);
    dependencies.logger.info({ signal, deadlineAt }, "Application shutdown started");

    shutdownPromise = (async () => {
      let failed = false;
      const steps = [
        ["collaboration", dependencies.closeCollaboration],
        ["database", dependencies.closeDatabase],
        ["valkey", dependencies.closeValkey],
      ] as const;

      for (const [step, close] of steps) {
        try {
          await runBeforeDeadline(step, close, deadlineAt, now, setTimeoutFn, clearTimeoutFn);
        } catch (error) {
          failed = true;
          dependencies.logger.error(
            { step, errorName: error instanceof Error ? error.name : "UnknownError" },
            "Application resource shutdown failed",
          );
        }
      }

      process.exitCode = failed ? 1 : 0;
    })();

    return shutdownPromise;
  };
}

async function runBeforeDeadline(
  step: string,
  close: () => Promise<void>,
  deadlineAt: number,
  now: () => number,
  setTimeoutFn: typeof setTimeout,
  clearTimeoutFn: typeof clearTimeout,
): Promise<void> {
  const operation = Promise.resolve().then(close);
  const remaining = deadlineAt - now();
  if (remaining <= 0) {
    void operation.catch(() => undefined);
    throw new ShutdownDeadlineError(step);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeoutFn(() => reject(new ShutdownDeadlineError(step)), remaining);
  });
  try {
    await Promise.race([operation, timeout]);
  } finally {
    if (timer) {
      clearTimeoutFn(timer);
    }
  }
}
