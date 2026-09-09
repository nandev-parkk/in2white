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

  it("whiteboardDocuments schema exposes a nullable deletedAt column", () => {
    expect(schema.whiteboardDocuments.deletedAt).toBeDefined();
  });
});
