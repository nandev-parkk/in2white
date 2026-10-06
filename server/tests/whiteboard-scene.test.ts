import { describe, expect, it } from "vitest";
import { WHITEBOARD_LIMITS } from "@/realtime/whiteboard-limits";
import { WhiteboardScene } from "@/realtime/whiteboard-scene";
import type { WhiteboardElement, WhiteboardFile, WhiteboardSnapshot } from "@/types/whiteboard";

function element(
  id: string,
  version: number,
  versionNonce = 1,
  isDeleted = false,
): WhiteboardElement {
  return { id, version, versionNonce, isDeleted, type: "rectangle" };
}

const file1: WhiteboardFile = {
  id: "file-1",
  mimeType: "image/png",
  dataURL: "data:image/png;base64,AA==",
  created: 1,
  version: 1,
};

const file2: WhiteboardFile = {
  ...file1,
  id: "file-2",
};

const lastSavedAt = new Date("2026-09-11T00:00:00.000Z");

function snapshotWith(...elements: WhiteboardElement[]): WhiteboardSnapshot {
  return {
    canvasContent: { elements },
    revision: 0,
    lastSavedAt,
  };
}

const emptySnapshot = snapshotWith();

describe("WhiteboardScene", () => {
  it("does not increment the revision for a stale no-op update", () => {
    const scene = WhiteboardScene.fromSnapshot(snapshotWith(element("a", 2)));
    const result = scene.applyUpdate({
      elements: [element("a", 1)],
      fileUpdates: {},
    });

    expect(result).toMatchObject({ status: "noop", revision: 0 });
    expect(scene.toSnapshot().canvasContent.elements).toEqual([element("a", 2)]);
  });

  it("keeps concurrent files from separate updates", () => {
    const scene = WhiteboardScene.fromSnapshot(emptySnapshot);
    scene.applyUpdate({ elements: [], fileUpdates: { "file-1": file1 } });
    scene.applyUpdate({ elements: [], fileUpdates: { "file-2": file2 } });

    expect(Object.keys(scene.toSnapshot().canvasContent.files ?? {})).toEqual(["file-1", "file-2"]);
  });

  it("keeps existing element order and appends new ids", () => {
    const scene = WhiteboardScene.fromSnapshot(snapshotWith(element("a", 1), element("b", 1)));

    const result = scene.applyUpdate({
      elements: [element("b", 2), element("c", 1)],
    });

    expect(result).toEqual({
      status: "updated",
      revision: 1,
      elements: [element("b", 2), element("c", 1)],
    });
    expect(scene.toSnapshot().canvasContent.elements).toEqual([
      element("a", 1),
      element("b", 2),
      element("c", 1),
    ]);
  });

  it("keeps a winning tombstone", () => {
    const scene = WhiteboardScene.fromSnapshot(snapshotWith(element("a", 1)));

    scene.applyUpdate({ elements: [element("a", 2, 1, true)] });

    expect(scene.toSnapshot().canvasContent.elements).toEqual([element("a", 2, 1, true)]);
  });

  it("returns one canonical element for duplicate ids in an update", () => {
    const scene = WhiteboardScene.fromSnapshot(emptySnapshot);

    expect(scene.applyUpdate({ elements: [element("a", 1), element("a", 2)] })).toEqual({
      status: "updated",
      revision: 1,
      elements: [element("a", 2)],
    });
    expect(scene.toSnapshot().canvasContent.elements).toEqual([element("a", 2)]);
  });

  it("does not apply elements when a file conflicts", () => {
    const scene = WhiteboardScene.fromSnapshot({
      ...emptySnapshot,
      canvasContent: {
        elements: [element("a", 1)],
        files: { "file-1": file1 },
      },
    });

    expect(
      scene.applyUpdate({
        elements: [element("a", 2)],
        fileUpdates: {
          "file-1": { ...file1, dataURL: "data:image/png;base64,BB==" },
        },
      }),
    ).toEqual({ status: "file_conflict", revision: 0, fileId: "file-1" });
    expect(scene.toSnapshot()).toEqual({
      canvasContent: {
        elements: [element("a", 1)],
        files: { "file-1": file1 },
      },
      revision: 0,
      lastSavedAt,
    });
  });

  it("broadcasts only file entries that changed the canonical scene", () => {
    const scene = WhiteboardScene.fromSnapshot(emptySnapshot);

    expect(scene.applyUpdate({ elements: [], fileUpdates: { "file-1": file1 } })).toEqual({
      status: "updated",
      revision: 1,
      elements: [],
      fileUpdates: { "file-1": file1 },
    });
    expect(
      scene.applyUpdate({
        elements: [],
        fileUpdates: { "file-1": { ...file1, lastRetrieved: 2 } },
      }),
    ).toEqual({ status: "noop", revision: 1 });
  });

  it("merges a persisted snapshot with local canonical changes", () => {
    const scene = WhiteboardScene.fromSnapshot({
      canvasContent: { elements: [element("local", 1)] },
      revision: 1,
      lastSavedAt,
    });
    scene.applyUpdate({
      elements: [element("local", 2)],
      fileUpdates: { "file-1": file1 },
    });
    const persistedAt = new Date("2026-09-11T00:01:00.000Z");

    const result = scene.mergeSnapshot({
      canvasContent: { elements: [element("persisted", 1)] },
      revision: 3,
      lastSavedAt: persistedAt,
    });

    expect(result).toEqual({
      changed: true,
      snapshot: {
        canvasContent: {
          elements: [element("persisted", 1), element("local", 2)],
          files: { "file-1": file1 },
        },
        revision: 4,
        lastSavedAt: persistedAt,
      },
    });
    expect(scene.persistedRevision).toBe(3);
  });

  it("tracks persistence metadata and scene measurements", () => {
    const scene = WhiteboardScene.fromSnapshot(snapshotWith(element("a", 1)));
    const persistedAt = new Date("2026-09-11T00:02:00.000Z");

    scene.applyUpdate({ elements: [element("b", 1)] });
    scene.setPersisted(persistedAt, 1);

    expect(scene.revision).toBe(1);
    expect(scene.persistedRevision).toBe(1);
    expect(scene.elementCount()).toBe(2);
    expect(scene.serializedSize()).toBe(
      Buffer.byteLength(JSON.stringify(scene.toSnapshot()), "utf8"),
    );
    expect(scene.toSnapshot().lastSavedAt).toEqual(persistedAt);
  });

  it("rejects a new element beyond the room limit without mutating the scene", () => {
    const elements = Array.from({ length: WHITEBOARD_LIMITS.elementsPerRoom }, (_, index) =>
      element(`element-${index}`, 1),
    );
    const scene = WhiteboardScene.fromSnapshot(snapshotWith(...elements));

    expect(scene.applyUpdate({ elements: [element("overflow", 1)] })).toEqual({
      status: "room_size_limit_exceeded",
      revision: 0,
    });
    expect(scene.elementCount()).toBe(WHITEBOARD_LIMITS.elementsPerRoom);
    expect(scene.revision).toBe(0);
  });

  it("allows updating an existing element at the room limit", () => {
    const elements = Array.from({ length: WHITEBOARD_LIMITS.elementsPerRoom }, (_, index) =>
      element(`element-${index}`, 1),
    );
    const scene = WhiteboardScene.fromSnapshot(snapshotWith(...elements));

    expect(scene.applyUpdate({ elements: [element("element-0", 2)] })).toMatchObject({
      status: "updated",
      revision: 1,
    });
    expect(scene.elementCount()).toBe(WHITEBOARD_LIMITS.elementsPerRoom);
  });

  it("rejects an oversized candidate snapshot atomically", () => {
    const scene = WhiteboardScene.fromSnapshot(snapshotWith(element("a", 1)));
    const oversizedFile: WhiteboardFile = {
      ...file1,
      dataURL: `data:image/png;base64,${"A".repeat(WHITEBOARD_LIMITS.snapshotBytesPerRoom)}`,
    };

    expect(
      scene.applyUpdate({
        elements: [element("a", 2)],
        fileUpdates: { "file-1": oversizedFile },
      }),
    ).toEqual({ status: "room_size_limit_exceeded", revision: 0 });
    expect(scene.toSnapshot()).toEqual(snapshotWith(element("a", 1)));
  });

  it("rejects an initial snapshot beyond the canonical element limit", () => {
    const elements = Array.from({ length: WHITEBOARD_LIMITS.elementsPerRoom + 1 }, (_, index) =>
      element(`element-${index}`, 1),
    );

    expect(() => WhiteboardScene.fromSnapshot(snapshotWith(...elements))).toThrow(
      "Whiteboard snapshot exceeds room limits",
    );
  });

  it("rejects an oversized conflict rebase without mutating the canonical scene", () => {
    const scene = WhiteboardScene.fromSnapshot(snapshotWith(element("local", 1)));
    const persistedElements = Array.from(
      { length: WHITEBOARD_LIMITS.elementsPerRoom },
      (_, index) => element(`persisted-${index}`, 1),
    );

    expect(() => scene.mergeSnapshot(snapshotWith(...persistedElements))).toThrow(
      "Whiteboard snapshot exceeds room limits",
    );
    expect(scene.toSnapshot()).toEqual(snapshotWith(element("local", 1)));
  });
});
