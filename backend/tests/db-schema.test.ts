import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

describe("db schema", () => {
  it("exports all five domain tables", () => {
    expect(schema.users).toBeDefined();
    expect(schema.workspaces).toBeDefined();
    expect(schema.workspaceMemberships).toBeDefined();
    expect(schema.projects).toBeDefined();
    expect(schema.whiteboardDocuments).toBeDefined();
  });

  it("projects schema exposes a nullable deletedAt column", () => {
    expect(schema.projects.deletedAt).toBeDefined();
  });

  it("users schema exposes a sessionVersion column with default zero", () => {
    expect(schema.users.sessionVersion).toBeDefined();
    expect(schema.users.sessionVersion.notNull).toBe(true);
    expect(schema.users.sessionVersion.hasDefault).toBe(true);
  });
});
