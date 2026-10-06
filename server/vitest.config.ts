import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      VALKEY_URL: "redis://localhost:6379",
      JWT_SECRET: "test-secret-key-with-at-least-32-characters",
      JWT_REFRESH_SECRET: "test-refresh-secret-key-with-at-least-32-chars",
      JWT_ADMIN_SECRET: "test-admin-secret-key-with-at-least-32-characters",
      JWT_ADMIN_REFRESH_SECRET: "test-admin-refresh-secret-key-with-at-least-32-ch",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
