import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const integration = process.env.RUN_DATABASE_INTEGRATION_TESTS === "1" ? describe : describe.skip;
const execFileAsync = promisify(execFile);
const script = fileURLToPath(new URL("../src/scripts/provision-database.ts", import.meta.url));

integration("PostgreSQL provisioning", () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(
      process.env.TEST_POSTGRES_IMAGE ?? "postgres:17-alpine",
    ).start();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("전용 역할·DB를 만들고 다시 실행해도 앱 계정으로 연결된다", async () => {
    const appUrl = new URL(container.getConnectionUri());
    appUrl.username = "in2white_app";
    appUrl.password = "test'password";
    appUrl.pathname = "/in2white_app";

    const env = {
      ...process.env,
      POSTGRES_ADMIN_URL: container.getConnectionUri(),
      DATABASE_URL: appUrl.toString(),
    };

    await execFileAsync(process.execPath, ["--import", "tsx", script], { env });
    await execFileAsync(process.execPath, ["--import", "tsx", script], { env });

    const db = postgres(appUrl.toString(), { max: 1 });
    try {
      const [identity] = await db`select current_database() as database, current_user as username`;
      expect(identity).toEqual({ database: "in2white_app", username: "in2white_app" });
    } finally {
      await db.end();
    }
  });
});
