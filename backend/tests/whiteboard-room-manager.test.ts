import { afterEach, describe, expect, it, vi } from "vitest";
import { WHITEBOARD_LIMITS } from "@/realtime/whiteboard-limits";
import { WhiteboardDrainError, WhiteboardRoomManager } from "@/realtime/whiteboard-room-manager";
import type { WhiteboardElement, WhiteboardFile, WhiteboardSnapshot } from "@/types/whiteboard";

const documentId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const anotherDocumentId = "8ba7b810-9dad-41d1-80b4-00c04fd430c9";

function element(id: string, version: number, versionNonce = 1): WhiteboardElement {
  return { id, version, versionNonce, isDeleted: false, type: "rectangle" };
}

function file(id: string, version = 0): WhiteboardFile {
  return { id, mimeType: "image/png", dataURL: `data:image/png;base64,${id}`, created: 1, version };
}

function snapshot(elements: WhiteboardElement[] = [], revision = 0): WhiteboardSnapshot {
  return {
    canvasContent: { elements },
    revision,
    lastSavedAt: new Date("2026-09-11T00:00:00.000Z"),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createManager({
  loadSnapshot = vi.fn().mockResolvedValue(snapshot()),
  saveSnapshot = vi.fn().mockResolvedValue({
    status: "saved",
    lastSavedAt: new Date("2026-09-11T00:00:01.000Z"),
  }),
  onRoomEvent = vi.fn(),
  now = () => Date.now(),
}: {
  loadSnapshot?: ReturnType<typeof vi.fn>;
  saveSnapshot?: ReturnType<typeof vi.fn>;
  onRoomEvent?: ReturnType<typeof vi.fn>;
  now?: () => number;
} = {}) {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const manager = new WhiteboardRoomManager({
    loadSnapshot,
    saveSnapshot,
    onRoomEvent,
    random: () => 1,
    now,
    logger,
  });
  return { manager, loadSnapshot, saveSnapshot, onRoomEvent, logger };
}

async function join(manager: WhiteboardRoomManager, socketId = "socket-1", userId = "user-1") {
  return manager.join(socketId, { userId, name: userId }, documentId, snapshot());
}

function update(id: string, version = 1) {
  return {
    documentId,
    clientUpdateId: `00000000-0000-4000-8000-${id.padStart(12, "0")}`,
    elements: [element(id, version)],
  };
}

afterEach(() => vi.useRealTimers());

describe("WhiteboardRoomManager", () => {
  it("uses canonical in-memory state for later joins", async () => {
    const { manager } = createManager();
    await manager.join(
      "socket-1",
      { userId: "user-1", name: "one" },
      documentId,
      snapshot([element("a", 1)]),
    );
    manager.updateScene("socket-1", update("b"));
    const joined = await manager.join(
      "socket-2",
      { userId: "user-2", name: "two" },
      documentId,
      snapshot(),
    );

    expect(joined).toMatchObject({ status: "joined", savedRevision: 0, persistenceState: "dirty" });
    if (joined.status === "joined") {
      expect(joined.snapshot.canvasContent.elements.map((item) => item.id)).toEqual(["a", "b"]);
      expect(joined.snapshot.revision).toBe(1);
    }
  });

  it("keeps file deltas from concurrent updates", async () => {
    const { manager } = createManager();
    await join(manager);
    manager.updateScene("socket-1", {
      ...update("1"),
      elements: [],
      fileUpdates: { first: file("first") },
    });
    manager.updateScene("socket-1", {
      ...update("2"),
      elements: [],
      fileUpdates: { second: file("second") },
    });
    const joined = await manager.join(
      "socket-2",
      { userId: "user-2", name: "two" },
      documentId,
      snapshot(),
    );

    expect(joined.status).toBe("joined");
    if (joined.status === "joined") {
      expect(Object.keys(joined.snapshot.canvasContent.files ?? {})).toEqual(["first", "second"]);
    }
  });

  it("returns noop without revision, save, or scene event", async () => {
    vi.useFakeTimers();
    const { manager, saveSnapshot, onRoomEvent } = createManager();
    await manager.join(
      "socket-1",
      { userId: "user-1", name: "one" },
      documentId,
      snapshot([element("a", 2)], 1),
    );

    expect(manager.updateScene("socket-1", update("a", 1))).toMatchObject({
      status: "noop",
      revision: 1,
    });
    await vi.runAllTimersAsync();
    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(onRoomEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "scene_updated" }),
    );
  });

  it("returns duplicate for a repeated participant update id", async () => {
    const { manager } = createManager();
    await join(manager);
    const input = update("a");
    const first = manager.updateScene("socket-1", input);
    expect(manager.updateScene("socket-1", input)).toEqual({ ...first, status: "duplicate" });
  });

  it("rejects participant and socket capacity before mutating the room", async () => {
    const { manager } = createManager();
    for (let index = 0; index < WHITEBOARD_LIMITS.participantsPerRoom; index += 1) {
      expect((await join(manager, `socket-${index}`, `user-${index}`)).status).toBe("joined");
    }
    expect((await join(manager, "overflow", "overflow-user")).status).toBe(
      "room_capacity_exceeded",
    );

    for (
      let index = WHITEBOARD_LIMITS.participantsPerRoom;
      index < WHITEBOARD_LIMITS.socketsPerRoom;
      index += 1
    ) {
      expect((await join(manager, `socket-${index}`, "user-0")).status).toBe("joined");
    }
    expect((await join(manager, "socket-overflow", "user-0")).status).toBe(
      "room_socket_capacity_exceeded",
    );
  });

  it("rejects a join when persisted content exceeds room limits", async () => {
    const { manager } = createManager();
    const elements = Array.from({ length: WHITEBOARD_LIMITS.elementsPerRoom + 1 }, (_, index) =>
      element(`element-${index}`, 1),
    );

    await expect(
      manager.join("socket-1", { userId: "user-1", name: "one" }, documentId, snapshot(elements)),
    ).resolves.toEqual({ status: "content_integrity_error", documentId });
  });

  it("keeps the current room when switching to oversized persisted content fails", async () => {
    const { manager } = createManager();
    await join(manager);
    const elements = Array.from({ length: WHITEBOARD_LIMITS.elementsPerRoom + 1 }, (_, index) =>
      element(`element-${index}`, 1),
    );

    await expect(
      manager.join(
        "socket-1",
        { userId: "user-1", name: "one" },
        anotherDocumentId,
        snapshot(elements),
      ),
    ).resolves.toEqual({ status: "content_integrity_error", documentId: anotherDocumentId });
    expect(manager.updateScene("socket-1", update("still-joined"))).toMatchObject({
      status: "updated",
      documentId,
    });
  });

  it("rebases a conflict, emits the merged canonical snapshot, and retries", async () => {
    vi.useFakeTimers();
    const latest = snapshot([element("remote", 1)], 1);
    const saveSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ status: "conflict" })
      .mockResolvedValueOnce({ status: "saved", lastSavedAt: new Date("2026-09-11T00:00:03Z") });
    const { manager, onRoomEvent } = createManager({
      loadSnapshot: vi.fn().mockResolvedValue(latest),
      saveSnapshot,
    });
    await join(manager);
    manager.updateScene("socket-1", update("local"));

    await vi.advanceTimersByTimeAsync(500);
    await vi.runAllTicks();
    expect(onRoomEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "sync_required",
        savedRevision: 1,
        persistenceState: "saving",
        snapshot: expect.objectContaining({
          canvasContent: expect.objectContaining({
            elements: [element("remote", 1), element("local", 1)],
          }),
        }),
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect(saveSnapshot).toHaveBeenCalledTimes(2);
  });

  it("terminates the room when a conflict rebase exceeds room limits", async () => {
    vi.useFakeTimers();
    const persistedElements = Array.from(
      { length: WHITEBOARD_LIMITS.elementsPerRoom },
      (_, index) => element(`persisted-${index}`, 1),
    );
    const { manager, onRoomEvent } = createManager({
      loadSnapshot: vi.fn().mockResolvedValue(snapshot(persistedElements, 1)),
      saveSnapshot: vi.fn().mockResolvedValue({ status: "conflict" }),
    });
    await join(manager);
    manager.updateScene("socket-1", update("local"));

    await vi.advanceTimersByTimeAsync(500);

    expect(onRoomEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        code: "CONTENT_INTEGRITY_ERROR",
        socketIds: ["socket-1"],
      }),
    );
    expect(manager.updateScene("socket-1", update("after"))).toMatchObject({
      status: "not_joined",
    });
  });

  it("blocks after three consecutive conflicts", async () => {
    vi.useFakeTimers();
    const { manager, onRoomEvent } = createManager({
      saveSnapshot: vi.fn().mockResolvedValue({ status: "conflict" }),
    });
    await join(manager);
    manager.updateScene("socket-1", update("local"));

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(manager.updateScene("socket-1", update("rejected"))).toMatchObject({
      status: "persistence_unavailable",
    });
    expect(onRoomEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "save_failed", code: "PERSISTENCE_UNAVAILABLE" }),
    );
  });

  it("blocks after five transient failures and recovers after a later save", async () => {
    vi.useFakeTimers();
    const saveSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockRejectedValueOnce(new Error("3"))
      .mockRejectedValueOnce(new Error("4"))
      .mockRejectedValueOnce(new Error("5"))
      .mockResolvedValueOnce({ status: "saved", lastSavedAt: new Date("2026-09-11T00:00:03Z") });
    const { manager, onRoomEvent } = createManager({ saveSnapshot });
    await join(manager);
    manager.updateScene("socket-1", update("local"));

    for (const delay of [500, 500, 1_000, 2_000, 4_000]) {
      await vi.advanceTimersByTimeAsync(delay);
      await vi.runAllTicks();
    }
    await expect(
      manager.join("socket-2", { userId: "user-2", name: "two" }, documentId, snapshot()),
    ).resolves.toMatchObject({
      status: "joined",
      savedRevision: 0,
      persistenceState: "blocked",
    });
    expect(manager.updateScene("socket-1", update("rejected"))).toMatchObject({
      status: "persistence_unavailable",
    });
    await vi.advanceTimersByTimeAsync(8_000);
    expect(onRoomEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "recovered" }));
    expect(manager.updateScene("socket-1", update("accepted"))).toMatchObject({
      status: "updated",
    });
  });

  it("stays blocked when a transient outage changes into a conflict until a save succeeds", async () => {
    vi.useFakeTimers();
    const saveSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockRejectedValueOnce(new Error("3"))
      .mockRejectedValueOnce(new Error("4"))
      .mockRejectedValueOnce(new Error("5"))
      .mockResolvedValueOnce({ status: "conflict" })
      .mockResolvedValueOnce({ status: "saved", lastSavedAt: new Date("2026-09-11T00:00:03Z") });
    const { manager, onRoomEvent } = createManager({ saveSnapshot });
    await join(manager);
    manager.updateScene("socket-1", update("local"));

    for (const delay of [500, 500, 1_000, 2_000, 4_000, 8_000]) {
      await vi.advanceTimersByTimeAsync(delay);
      await vi.runAllTicks();
    }

    expect(manager.updateScene("socket-1", update("still-rejected"))).toMatchObject({
      status: "persistence_unavailable",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(onRoomEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "recovered" }));
  });

  it("stays blocked when conflicts change into a transient outage until a save succeeds", async () => {
    vi.useFakeTimers();
    const saveSnapshot = vi
      .fn()
      .mockResolvedValueOnce({ status: "conflict" })
      .mockResolvedValueOnce({ status: "conflict" })
      .mockResolvedValueOnce({ status: "conflict" })
      .mockRejectedValueOnce(new Error("database unavailable"))
      .mockResolvedValueOnce({ status: "saved", lastSavedAt: new Date("2026-09-11T00:00:03Z") });
    const { manager, onRoomEvent } = createManager({ saveSnapshot });
    await join(manager);
    manager.updateScene("socket-1", update("local"));

    for (const delay of [500, 500, 1_000, 2_000]) {
      await vi.advanceTimersByTimeAsync(delay);
      await vi.runAllTicks();
    }

    expect(manager.updateScene("socket-1", update("still-rejected"))).toMatchObject({
      status: "persistence_unavailable",
    });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(onRoomEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "recovered" }));
  });

  it.each([
    ["not_found", "deleted", "DOCUMENT_NOT_FOUND"],
    ["content_missing", "failed", "CONTENT_INTEGRITY_ERROR"],
  ] as const)("turns %s into a terminal %s room", async (saveStatus, eventStatus, code) => {
    vi.useFakeTimers();
    const { manager, onRoomEvent } = createManager({
      saveSnapshot: vi.fn().mockResolvedValue({ status: saveStatus }),
    });
    await join(manager);
    manager.updateScene("socket-1", update("local"));
    await vi.advanceTimersByTimeAsync(500);

    expect(onRoomEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: eventStatus, code, socketIds: ["socket-1"] }),
    );
    expect(manager.updateScene("socket-1", update("after"))).toMatchObject({
      status: "not_joined",
    });
  });

  it("persists an update received during an in-flight save before close resolves", async () => {
    vi.useFakeTimers();
    const first = deferred<{ status: "saved"; lastSavedAt: Date }>();
    const saveSnapshot = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ status: "saved", lastSavedAt: new Date("2026-09-11T00:00:02Z") });
    const { manager } = createManager({ saveSnapshot });
    await join(manager);
    manager.updateScene("socket-1", update("one"));
    await vi.advanceTimersByTimeAsync(500);
    manager.updateScene("socket-1", update("two"));

    const closing = manager.close({ deadlineAt: Date.now() + 20_000 });
    expect(manager.close({ deadlineAt: Date.now() + 20_000 })).toBe(closing);
    expect(manager.updateScene("socket-1", update("three"))).toMatchObject({
      status: "server_draining",
    });
    first.resolve({ status: "saved", lastSavedAt: new Date("2026-09-11T00:00:01Z") });
    await vi.runAllTicks();
    await closing;
    expect(saveSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 2 }));
  });

  it("throws a body-free drain error when the deadline expires with dirty rooms", async () => {
    let now = 10_000;
    const { manager } = createManager({
      now: () => now,
      saveSnapshot: vi.fn().mockRejectedValue(new Error("database unavailable")),
    });
    await join(manager);
    manager.updateScene("socket-1", update("local"));
    now = 10_001;

    const error = await manager.close({ deadlineAt: 10_000 }).catch((caught) => caught);
    expect(error).toBeInstanceOf(WhiteboardDrainError);
    expect(error).toMatchObject({ dirtyRooms: [{ documentId, revision: 1 }] });
    expect(JSON.stringify(error)).not.toContain("canvasContent");
  });

  it("keeps a participant until their final socket leaves", async () => {
    const { manager } = createManager();
    await join(manager, "socket-1", "user-1");
    await join(manager, "socket-2", "user-1");
    expect(manager.leave("socket-1")).toMatchObject({ participantLeft: false });
    expect(manager.leave("socket-2")).toMatchObject({ participantLeft: true, roomEmpty: true });
  });
});
