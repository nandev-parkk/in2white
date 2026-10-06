import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApplicationShutdown } from "@/server-shutdown";

describe("createApplicationShutdown", () => {
  let previousExitCode: typeof process.exitCode;

  beforeEach(() => {
    previousExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = previousExitCode;
  });

  it("shares one promise and closes resources after collaboration drain", async () => {
    const callOrder: string[] = [];
    const shutdown = createApplicationShutdown({
      closeCollaboration: async () => {
        callOrder.push("collaboration");
      },
      closeDatabase: async () => {
        callOrder.push("database");
      },
      closeValkey: async () => {
        callOrder.push("valkey");
      },
      logger: { info: vi.fn(), error: vi.fn() },
      now: () => 1_000,
    });

    const first = shutdown("SIGTERM");
    const second = shutdown("SIGINT");

    expect(second).toBe(first);
    await first;
    expect(callOrder).toEqual(["collaboration", "database", "valkey"]);
    expect(process.exitCode).toBe(0);
  });

  it.each(["collaboration", "database", "valkey"] as const)(
    "sets exitCode 1 and still attempts later resources when %s close fails",
    async (failedStep) => {
      const callOrder: string[] = [];
      const close = (step: string) => async () => {
        callOrder.push(step);
        if (step === failedStep) {
          throw new Error(`${step} failed`);
        }
      };
      const logger = { info: vi.fn(), error: vi.fn() };
      const shutdown = createApplicationShutdown({
        closeCollaboration: close("collaboration"),
        closeDatabase: close("database"),
        closeValkey: close("valkey"),
        logger,
        now: () => 1_000,
      });

      await shutdown("SIGTERM");

      expect(callOrder).toEqual(["collaboration", "database", "valkey"]);
      expect(process.exitCode).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ step: failedStep }),
        expect.any(String),
      );
    },
  );

  it("uses one absolute deadline and reports timeout without skipping later close attempts", async () => {
    let now = 1_000;
    const callOrder: string[] = [];
    const logger = { info: vi.fn(), error: vi.fn() };
    const shutdown = createApplicationShutdown({
      closeCollaboration: async () => {
        callOrder.push("collaboration");
        now = 21_001;
      },
      closeDatabase: async () => {
        callOrder.push("database");
      },
      closeValkey: async () => {
        callOrder.push("valkey");
      },
      logger,
      now: () => now,
      deadlineMs: 20_000,
    });

    await shutdown("SIGTERM");

    expect(callOrder).toEqual(["collaboration", "database", "valkey"]);
    expect(process.exitCode).toBe(1);
    expect(logger.error).toHaveBeenCalled();
  });
});
