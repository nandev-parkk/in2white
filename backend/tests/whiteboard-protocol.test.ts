import { describe, expect, it } from "vitest";
import {
  whiteboardJoinPayloadSchema,
  whiteboardPresenceUpdatePayloadSchema,
  whiteboardSceneUpdatePayloadSchema,
} from "@/realtime/whiteboard-protocol.schema";

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const documentId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const clientUpdateId = "2f1c3d5e-6a7b-48c9-8d0e-1f2a3b4c5d6e";

const validElement = {
  id: "element-1",
  version: 1,
  versionNonce: 10,
  isDeleted: false,
  type: "rectangle",
  x: 10,
};

const file = {
  id: "file-1",
  mimeType: "image/png",
  dataURL: "data:image/png;base64,AA==",
  created: 1,
  version: 1,
};

describe("whiteboard realtime protocol schemas", () => {
  it("requires all UUIDs for join", () => {
    expect(whiteboardJoinPayloadSchema.parse({ workspaceId, projectId, documentId })).toEqual({
      workspaceId,
      projectId,
      documentId,
    });
    expect(() =>
      whiteboardJoinPayloadSchema.parse({ workspaceId, projectId, documentId: "invalid" }),
    ).toThrow();
  });

  it("accepts Excalidraw fields beyond the merge contract", () => {
    const result = whiteboardSceneUpdatePayloadSchema.parse({
      documentId,
      clientUpdateId,
      elements: [validElement],
      fileUpdates: { "file-1": { ...file, extra: "preserved" } },
    });

    expect(result.elements[0]).toEqual(validElement);
    expect(result.fileUpdates?.["file-1"]).toEqual({ ...file, extra: "preserved" });
  });

  it("requires all mandatory file fields", () => {
    for (const field of ["id", "mimeType", "dataURL", "created"] as const) {
      const invalidFile: Partial<typeof file> = { ...file };
      delete invalidFile[field];

      expect(
        whiteboardSceneUpdatePayloadSchema.safeParse({
          documentId,
          clientUpdateId,
          elements: [],
          fileUpdates: { "file-1": invalidFile },
        }).success,
      ).toBe(false);
    }
  });

  it.each([-1, 1.5])("accepts finite created value %s", (created) => {
    expect(
      whiteboardSceneUpdatePayloadSchema.safeParse({
        documentId,
        clientUpdateId,
        elements: [],
        fileUpdates: { "file-1": { ...file, created } },
      }).success,
    ).toBe(true);
  });

  it.each([Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects non-finite created value %s",
    (created) => {
      expect(
        whiteboardSceneUpdatePayloadSchema.safeParse({
          documentId,
          clientUpdateId,
          elements: [],
          fileUpdates: { "file-1": { ...file, created } },
        }).success,
      ).toBe(false);
    },
  );

  it("requires finite nonnegative integer file versions and lastRetrieved values", () => {
    for (const invalidFile of [
      { ...file, version: -1 },
      { ...file, version: 1.5 },
      { ...file, version: Number.POSITIVE_INFINITY },
      { ...file, lastRetrieved: -1 },
      { ...file, lastRetrieved: 1.5 },
      { ...file, lastRetrieved: Number.POSITIVE_INFINITY },
    ]) {
      expect(
        whiteboardSceneUpdatePayloadSchema.safeParse({
          documentId,
          clientUpdateId,
          elements: [],
          fileUpdates: { "file-1": invalidFile },
        }).success,
      ).toBe(false);
    }
  });

  it("requires the file map key to match file.id", () => {
    expect(
      whiteboardSceneUpdatePayloadSchema.safeParse({
        documentId,
        clientUpdateId,
        elements: [],
        fileUpdates: { "another-id": file },
      }).success,
    ).toBe(false);
  });

  it.each(["__proto__", "constructor", "prototype"])(
    "rejects reserved file id %s",
    (reservedFileId) => {
      const fileUpdates = Object.fromEntries([[reservedFileId, { ...file, id: reservedFileId }]]);

      expect(
        whiteboardSceneUpdatePayloadSchema.safeParse({
          documentId,
          clientUpdateId,
          elements: [],
          fileUpdates,
        }).success,
      ).toBe(false);
    },
  );

  it("rejects invalid scene updates and more than 2,000 elements", () => {
    expect(() =>
      whiteboardSceneUpdatePayloadSchema.parse({
        documentId,
        clientUpdateId,
        elements: [{ ...validElement, version: -1 }],
      }),
    ).toThrow();
    expect(() =>
      whiteboardSceneUpdatePayloadSchema.parse({
        documentId,
        clientUpdateId,
        elements: Array.from({ length: 2001 }, (_, index) => ({
          ...validElement,
          id: `element-${index}`,
        })),
      }),
    ).toThrow();
  });

  it("validates finite presence coordinates and active element limits", () => {
    expect(
      whiteboardPresenceUpdatePayloadSchema.parse({
        documentId,
        cursor: { x: 10, y: 20 },
        activeElementIds: ["element-1"],
      }),
    ).toEqual({
      documentId,
      cursor: { x: 10, y: 20 },
      activeElementIds: ["element-1"],
    });
    expect(() =>
      whiteboardPresenceUpdatePayloadSchema.parse({
        documentId,
        cursor: { x: Number.POSITIVE_INFINITY, y: 20 },
        activeElementIds: [],
      }),
    ).toThrow();
    expect(() =>
      whiteboardPresenceUpdatePayloadSchema.parse({
        documentId,
        cursor: null,
        activeElementIds: Array.from({ length: 51 }, (_, index) => `element-${index}`),
      }),
    ).toThrow();
  });
});
