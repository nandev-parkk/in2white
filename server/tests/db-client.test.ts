import { describe, expect, it } from "vitest";
import { db } from "@/db/client";

describe("db client", () => {
  it("creates a drizzle instance without connecting", () => {
    expect(db).toBeDefined();
  });
});
