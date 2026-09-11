import { createServer, type Server as HttpServer } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { createWhiteboardCollaborationServer } from "@/realtime/whiteboard-collaboration";
import { signAccessToken, verifyAccessToken } from "@/lib/jwt";
import type { WhiteboardDocumentDetail } from "@/services/whiteboard-document.service";
import type { SaveWhiteboardDocumentContentResult } from "@/services/whiteboard-document-content.service";
import type { WhiteboardSnapshot } from "@/types/whiteboard";
import { HttpError } from "@/utils/http-error";

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const documentId = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const anotherDocumentId = "8ba7b810-9dad-41d1-80b4-00c04fd430c9";
const clientUpdateId = "2f1c3d5e-6a7b-48c9-8d0e-1f2a3b4c5d6e";

const snapshot: WhiteboardSnapshot = {
  canvasContent: { elements: [] },
  revision: 0,
  lastSavedAt: new Date("2026-09-11T00:00:00.000Z"),
};

const whiteboardDocument: WhiteboardDocumentDetail = {
  id: documentId,
  projectId,
  name: "기획 보드",
  creatorId: "user-1",
  canvasContent: snapshot.canvasContent,
  revision: snapshot.revision,
  lastSavedAt: snapshot.lastSavedAt,
  createdAt: new Date("2026-09-10T00:00:00.000Z"),
  updatedAt: new Date("2026-09-11T00:00:00.000Z"),
};

async function createAccessToken(sub = "user-1") {
  return signAccessToken({ sub, email: `${sub}@example.com`, sid: `session-${sub}` });
}

function waitForEvent<T>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function emitWithAck<T>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("whiteboard collaboration server", () => {
  let httpServer: HttpServer;
  let collaboration: ReturnType<typeof createWhiteboardCollaborationServer>;
  let url: string;
  let clients: ClientSocket[];
  let saveSnapshot: ReturnType<typeof vi.fn>;
  let authorizeJoin: ReturnType<typeof vi.fn>;
  let verifyToken: ReturnType<typeof vi.fn>;
  let clockNow: number;

  beforeEach(async () => {
    httpServer = createServer();
    clients = [];
    clockNow = Date.now();
    saveSnapshot = vi
      .fn<(input: unknown) => Promise<SaveWhiteboardDocumentContentResult>>()
      .mockResolvedValue({
        status: "saved",
        lastSavedAt: new Date("2026-09-11T00:00:01.000Z"),
      });
    authorizeJoin = vi.fn().mockImplementation(async ({ userId }) => ({
      whiteboardDocument,
      participant: { userId, name: userId === "user-1" ? "첫 사용자" : "두 번째 사용자" },
    }));
    verifyToken = vi.fn().mockImplementation(verifyAccessToken);
    collaboration = createWhiteboardCollaborationServer(httpServer, {
      authorizeJoin,
      loadSnapshot: vi.fn().mockResolvedValue(snapshot),
      saveSnapshot,
      verifyToken,
      random: () => 0,
      now: () => clockNow,
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });
    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not bind to a port");
    }
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    for (const client of clients) {
      client.close();
    }
    await collaboration.close();
    if (httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  async function connect(sub = "user-1") {
    const client = createClient(url, {
      auth: { accessToken: await createAccessToken(sub) },
      reconnection: false,
    });
    clients.push(client);
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("connect_error", reject);
    });
    return client;
  }

  async function join(client: ClientSocket, joinedDocumentId = documentId) {
    return emitWithAck<{
      ok: boolean;
      whiteboardDocument?: Record<string, unknown>;
      participants?: unknown[];
      error?: { code: string };
    }>(client, "whiteboard:join", {
      workspaceId,
      projectId,
      documentId: joinedDocumentId,
    });
  }

  it("rejects a client without an access token with UNAUTHORIZED", async () => {
    const client = createClient(url, { reconnection: false });
    clients.push(client);

    await expect(
      new Promise<never>((_resolve, reject) => {
        client.once("connect_error", (error) => reject(error));
      }),
    ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
  });

  it("returns the snapshot and participants from a successful join", async () => {
    const client = await connect();

    await expect(join(client)).resolves.toEqual({
      ok: true,
      whiteboardDocument: {
        id: documentId,
        projectId,
        name: whiteboardDocument.name,
        canvasContent: { elements: [] },
        revision: 0,
        lastSavedAt: snapshot.lastSavedAt.toISOString(),
      },
      participants: [
        {
          userId: "user-1",
          name: "첫 사용자",
          presenceIndex: 0,
          cursor: null,
          activeElementIds: [],
        },
      ],
    });
  });

  it("returns CONTENT_INTEGRITY_ERROR when persisted content exceeds room limits", async () => {
    authorizeJoin.mockResolvedValueOnce({
      whiteboardDocument: {
        ...whiteboardDocument,
        canvasContent: {
          elements: Array.from({ length: 20_001 }, (_, index) => ({
            id: `element-${index}`,
            version: 1,
            versionNonce: 1,
            isDeleted: false,
          })),
        },
      },
      participant: { userId: "user-1", name: "첫 사용자" },
    });
    const client = await connect();

    await expect(join(client)).resolves.toMatchObject({
      ok: false,
      error: { code: "CONTENT_INTEGRITY_ERROR" },
    });
  });

  it.each(["WORKSPACE_NOT_FOUND", "PROJECT_NOT_FOUND", "WHITEBOARD_DOCUMENT_NOT_FOUND"])(
    "returns %s when join authorization fails",
    async (code) => {
      authorizeJoin.mockRejectedValueOnce(new HttpError(404, code, "접근 대상을 찾을 수 없습니다"));
      const client = await connect();

      await expect(join(client)).resolves.toEqual({
        ok: false,
        error: { code, message: "접근 대상을 찾을 수 없습니다" },
      });
    },
  );

  it("broadcasts scene updates to another client in the same document room", async () => {
    const first = await connect("user-1");
    const second = await connect("user-2");
    await join(first);
    await join(second);
    const updated = waitForEvent<{ documentId: string; sourceUserId: string; revision: number }>(
      second,
      "whiteboard:scene:updated",
    );

    const ack = await emitWithAck<{
      ok: boolean;
      revision?: number;
      appliedElements?: unknown[];
      savedRevision?: number;
    }>(first, "whiteboard:scene:update", {
      documentId,
      clientUpdateId,
      elements: [
        { id: "element-1", version: 1, versionNonce: 10, isDeleted: false, type: "rectangle" },
      ],
    });

    await expect(updated).resolves.toMatchObject({
      documentId,
      sourceUserId: "user-1",
      revision: 1,
    });
    expect(ack).toMatchObject({ ok: true, revision: 1, savedRevision: 0 });
  });

  it("broadcasts presence without persisting it", async () => {
    const first = await connect("user-1");
    const second = await connect("user-2");
    await join(first);
    await join(second);
    const updated = waitForEvent<{ documentId: string; participant: { userId: string } }>(
      second,
      "whiteboard:presence:updated",
    );

    first.emit("whiteboard:presence:update", {
      documentId,
      cursor: { x: 10, y: 20 },
      activeElementIds: ["element-1"],
    });

    await expect(updated).resolves.toMatchObject({
      documentId,
      participant: { userId: "user-1", cursor: { x: 10, y: 20 } },
    });
    expect(saveSnapshot).not.toHaveBeenCalled();
  });

  it("returns INVALID_PAYLOAD for an invalid scene update", async () => {
    const client = await connect();
    await join(client);

    await expect(
      emitWithAck<{ ok: boolean; error: { code: string } }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId: "not-a-uuid",
        elements: [],
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "INVALID_PAYLOAD", message: expect.any(String) },
    });
  });

  it("returns DOCUMENT_ROOM_MISMATCH for an update targeting another document", async () => {
    const client = await connect();
    await join(client);

    await expect(
      emitWithAck<{ ok: boolean; error: { code: string } }>(client, "whiteboard:scene:update", {
        documentId: anotherDocumentId,
        clientUpdateId,
        elements: [],
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "DOCUMENT_ROOM_MISMATCH", message: expect.any(String) },
    });
  });

  it("invalidates authorization that started before document deletion", async () => {
    const authorization = deferred<{
      whiteboardDocument: WhiteboardDocumentDetail;
      participant: { userId: string; name: string };
    }>();
    const started = deferred<void>();
    authorizeJoin.mockImplementationOnce(async ({ userId }) => {
      started.resolve();
      const authorized = await authorization.promise;
      return { ...authorized, participant: { userId, name: userId } };
    });
    const client = await connect();

    const joining = join(client);
    await started.promise;
    collaboration.documentDeleted(documentId);
    authorization.resolve({
      whiteboardDocument,
      participant: { userId: "user-1", name: "user-1" },
    });

    await expect(joining).resolves.toMatchObject({
      ok: false,
      error: { code: "WHITEBOARD_DOCUMENT_NOT_FOUND" },
    });
  });

  it("rejects an application payload larger than 1 MiB", async () => {
    const client = await connect();
    await join(client);

    await expect(
      emitWithAck<{ ok: false; error: { code: string } }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId,
        elements: [
          {
            id: "large",
            version: 1,
            versionNonce: 1,
            isDeleted: false,
            payload: "A".repeat(1_048_576),
          },
        ],
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "PAYLOAD_TOO_LARGE" } });
  });

  it("rate-limits the 41st scene update in one burst", async () => {
    const client = await connect();
    await join(client);

    for (let index = 0; index < 40; index += 1) {
      const ack = await emitWithAck<{ ok: boolean }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        elements: [],
      });
      expect(ack.ok).toBe(true);
    }
    await expect(
      emitWithAck<{ ok: false; error: { code: string } }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId: "00000000-0000-4000-8000-000000000041",
        elements: [],
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "RATE_LIMITED" } });
  });

  it("rejects the 31st unique participant", async () => {
    for (let index = 0; index < 30; index += 1) {
      const client = await connect(`participant-${index}`);
      await expect(join(client)).resolves.toMatchObject({ ok: true });
    }
    const overflow = await connect("participant-overflow");
    await expect(join(overflow)).resolves.toMatchObject({
      ok: false,
      error: { code: "ROOM_CAPACITY_EXCEEDED" },
    });
  }, 20_000);

  it("rejects the 61st socket including tabs from the same user", async () => {
    for (let index = 0; index < 60; index += 1) {
      const client = await connect("same-user");
      await expect(join(client)).resolves.toMatchObject({ ok: true });
    }
    const overflow = await connect("same-user");
    await expect(join(overflow)).resolves.toMatchObject({
      ok: false,
      error: { code: "ROOM_SOCKET_CAPACITY_EXCEEDED" },
    });
  }, 20_000);

  it("returns FILE_VERSION_CONFLICT for different binary data at the same version", async () => {
    const client = await connect();
    await join(client);
    const firstFile = {
      id: "file-1",
      mimeType: "image/png",
      dataURL: "data:image/png;base64,AA==",
      created: 1,
      version: 1,
    };
    await emitWithAck(client, "whiteboard:scene:update", {
      documentId,
      clientUpdateId,
      elements: [],
      fileUpdates: { "file-1": firstFile },
    });

    await expect(
      emitWithAck<{ ok: false; error: { code: string } }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId: "00000000-0000-4000-8000-000000000042",
        elements: [],
        fileUpdates: {
          "file-1": { ...firstFile, dataURL: "data:image/png;base64,BB==" },
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "FILE_VERSION_CONFLICT" } });
  });

  it("rejects an update that would grow the canonical room beyond 10 MiB", async () => {
    const client = await connect();
    await join(client);
    for (let index = 0; index < 10; index += 1) {
      const id = `file-${index}`;
      const ack = await emitWithAck<{ ok: boolean }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId: `10000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        elements: [],
        fileUpdates: {
          [id]: {
            id,
            mimeType: "image/png",
            dataURL: `data:image/png;base64,${"A".repeat(1_000_000)}`,
            created: 1,
          },
        },
      });
      expect(ack.ok).toBe(true);
    }
    const id = "file-overflow";
    await expect(
      emitWithAck<{ ok: false; error: { code: string } }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId: "10000000-0000-4000-8000-000000000011",
        elements: [],
        fileUpdates: {
          [id]: {
            id,
            mimeType: "image/png",
            dataURL: `data:image/png;base64,${"B".repeat(1_000_000)}`,
            created: 1,
          },
        },
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "ROOM_SIZE_LIMIT_EXCEEDED" } });
  });

  it("rejects edits with PERSISTENCE_UNAVAILABLE after conflict blocking", async () => {
    saveSnapshot.mockResolvedValue({ status: "conflict" });
    const client = await connect();
    await join(client);
    const failed = waitForEvent<{ code: string }>(client, "whiteboard:scene:save-failed");
    client.emit("whiteboard:scene:update", {
      documentId,
      clientUpdateId,
      elements: [{ id: "blocked", version: 1, versionNonce: 1, isDeleted: false }],
    });
    await expect(failed).resolves.toMatchObject({ code: "PERSISTENCE_UNAVAILABLE" });

    await expect(
      emitWithAck<{ ok: false; error: { code: string } }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId: "10000000-0000-4000-8000-000000000012",
        elements: [],
      }),
    ).resolves.toMatchObject({ ok: false, error: { code: "PERSISTENCE_UNAVAILABLE" } });
    collaboration.documentDeleted(documentId);
  });

  it("disconnects a transport message larger than 1.5 MiB", async () => {
    const client = await connect();
    await join(client);
    const disconnected = waitForEvent<string>(client, "disconnect");
    client.emit("whiteboard:scene:update", {
      documentId,
      clientUpdateId,
      elements: [],
      oversized: "A".repeat(1_600_000),
    });

    await expect(disconnected).resolves.toBeTruthy();
  });

  it("emits a repeated presence error only once during cooldown", async () => {
    const client = await connect();
    await join(client);
    const errors: Array<{ code: string }> = [];
    client.on("whiteboard:error", (error) => errors.push(error));

    client.emit("whiteboard:presence:update", {
      documentId,
      cursor: { x: Infinity, y: 0 },
      activeElementIds: [],
    });
    client.emit("whiteboard:presence:update", {
      documentId,
      cursor: { x: Infinity, y: 0 },
      activeElementIds: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(errors).toEqual([{ code: "INVALID_PAYLOAD", message: expect.any(String) }]);
  });

  it("rate-limits presence updates without broadcasting the rejected update", async () => {
    const first = await connect("user-1");
    const second = await connect("user-2");
    await join(first);
    await join(second);
    const errors: Array<{ code: string }> = [];
    const broadcastCursorXs: number[] = [];
    first.on("whiteboard:error", (error) => errors.push(error));
    second.on("whiteboard:presence:updated", (event) => {
      if (event.participant.cursor) {
        broadcastCursorXs.push(event.participant.cursor.x);
      }
    });

    for (let index = 0; index < 61; index += 1) {
      first.emit("whiteboard:presence:update", {
        documentId,
        cursor: { x: index, y: index },
        activeElementIds: [],
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(errors).toContainEqual({ code: "RATE_LIMITED", message: expect.any(String) });
    expect(broadcastCursorXs).not.toContain(60);
  });

  it("emits auth expired before disconnecting the socket", async () => {
    verifyToken.mockResolvedValueOnce({
      sub: "user-1",
      email: "user-1@example.com",
      sid: "session-user-1",
      type: "access",
      exp: (Date.now() + 50) / 1_000,
    });
    const client = await connect();
    const events: string[] = [];
    client.on("whiteboard:auth:expired", () => events.push("expired"));
    client.on("disconnect", () => events.push("disconnect"));

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(events).toEqual(["expired", "disconnect"]);
  });

  it("disconnects existing sockets and stops accepting connections while draining", async () => {
    const pendingSave = deferred<SaveWhiteboardDocumentContentResult>();
    saveSnapshot.mockReturnValueOnce(pendingSave.promise);
    const client = await connect();
    const unjoinedClient = await connect("user-2");
    await join(client);
    client.emit("whiteboard:scene:update", {
      documentId,
      clientUpdateId,
      elements: [{ id: "dirty", version: 1, versionNonce: 1, isDeleted: false }],
    });
    await new Promise((resolve) => setTimeout(resolve, 550));

    const clientDisconnected = waitForEvent(client, "disconnect");
    const unjoinedClientDisconnected = waitForEvent(unjoinedClient, "disconnect");
    const closing = collaboration.close();
    try {
      await Promise.all([clientDisconnected, unjoinedClientDisconnected]);
      expect(httpServer.listening).toBe(false);

      const newClient = createClient(url, {
        auth: { accessToken: await createAccessToken("user-3") },
        reconnection: false,
      });
      clients.push(newClient);
      await expect(
        new Promise<never>((_resolve, reject) => {
          newClient.once("connect_error", reject);
        }),
      ).rejects.toBeInstanceOf(Error);
    } finally {
      pendingSave.resolve({
        status: "saved",
        lastSavedAt: new Date("2026-09-11T00:00:02.000Z"),
      });
      await closing;
    }
  });

  it("rejects a handshake whose token verification finishes after draining starts", async () => {
    const pendingSave = deferred<SaveWhiteboardDocumentContentResult>();
    saveSnapshot.mockReturnValueOnce(pendingSave.promise);
    const joinedClient = await connect();
    await join(joinedClient);
    joinedClient.emit("whiteboard:scene:update", {
      documentId,
      clientUpdateId,
      elements: [{ id: "dirty", version: 1, versionNonce: 1, isDeleted: false }],
    });
    await new Promise((resolve) => setTimeout(resolve, 550));

    const pendingVerification = deferred<Awaited<ReturnType<typeof verifyAccessToken>>>();
    verifyToken.mockReturnValueOnce(pendingVerification.promise);
    const racingClient = createClient(url, {
      auth: { accessToken: await createAccessToken("user-2") },
      reconnection: false,
    });
    clients.push(racingClient);
    await vi.waitFor(() => expect(verifyToken).toHaveBeenCalledTimes(2));

    let connected = false;
    racingClient.once("connect", () => {
      connected = true;
    });
    const closing = collaboration.close();
    pendingVerification.resolve({
      sub: "user-2",
      email: "user-2@example.com",
      sid: "session-user-2",
      type: "access",
      exp: Date.now() / 1_000 + 60,
    });

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(connected).toBe(false);
    } finally {
      racingClient.close();
      pendingSave.resolve({
        status: "saved",
        lastSavedAt: new Date("2026-09-11T00:00:02.000Z"),
      });
      await closing;
    }
  });

  it("serializes concurrent joins from the same socket", async () => {
    const client = await connect();
    let releaseFirstJoin!: () => void;
    let firstJoinStarted!: () => void;
    const firstJoinGate = new Promise<void>((resolve) => {
      releaseFirstJoin = resolve;
    });
    const firstJoinStartedPromise = new Promise<void>((resolve) => {
      firstJoinStarted = resolve;
    });
    authorizeJoin.mockImplementation(async ({ documentId: requestedDocumentId, userId }) => {
      if (requestedDocumentId === documentId) {
        firstJoinStarted();
        await firstJoinGate;
      }
      return {
        whiteboardDocument: { ...whiteboardDocument, id: requestedDocumentId },
        participant: { userId, name: "첫 사용자" },
      };
    });

    const first = join(client, documentId);
    await firstJoinStartedPromise;
    const second = join(client, anotherDocumentId);
    releaseFirstJoin();

    await expect(first).resolves.toMatchObject({ ok: true });
    await expect(second).resolves.toMatchObject({ ok: true });

    await expect(
      emitWithAck<{ ok: boolean; error: { code: string } }>(client, "whiteboard:scene:update", {
        documentId,
        clientUpdateId,
        elements: [],
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "DOCUMENT_ROOM_MISMATCH" },
    });
  });

  it("broadcasts the merged canonical snapshot after a revision conflict", async () => {
    saveSnapshot.mockResolvedValueOnce({ status: "conflict" });
    const client = await connect();
    await join(client);
    const syncRequired = waitForEvent<Record<string, unknown>>(client, "whiteboard:sync:required");

    client.emit("whiteboard:scene:update", {
      documentId,
      clientUpdateId,
      elements: [
        { id: "element-1", version: 1, versionNonce: 10, isDeleted: false, type: "rectangle" },
      ],
    });

    await expect(syncRequired).resolves.toMatchObject({
      documentId,
      snapshot: {
        canvasContent: {
          elements: [
            {
              id: "element-1",
              version: 1,
              versionNonce: 10,
              isDeleted: false,
              type: "rectangle",
            },
          ],
        },
        revision: 1,
      },
    });
  });

  it("sends a deleted event and disconnects room clients", async () => {
    const client = await connect();
    await join(client);
    const deleted = waitForEvent<{ documentId: string }>(client, "whiteboard:document:deleted");
    const disconnected = waitForEvent<string>(client, "disconnect");

    collaboration.documentDeleted(documentId);
    await expect(deleted).resolves.toEqual({ documentId });
    await expect(disconnected).resolves.toBe("io server disconnect");
  });

  it("closes the attached HTTP server through the collaboration close path", async () => {
    expect(httpServer.listening).toBe(true);

    await collaboration.close();

    expect(httpServer.listening).toBe(false);
  });

  it("stops the HTTP server while a dirty room is still draining", async () => {
    const saveStarted = deferred<void>();
    const saveCompleted = deferred<SaveWhiteboardDocumentContentResult>();
    saveSnapshot.mockImplementationOnce(() => {
      saveStarted.resolve();
      return saveCompleted.promise;
    });
    const client = await connect();
    await join(client);
    await emitWithAck(client, "whiteboard:scene:update", {
      documentId,
      clientUpdateId,
      elements: [{ id: "pending", version: 1, versionNonce: 1, isDeleted: false }],
    });
    await saveStarted.promise;

    const closePromise = collaboration.close();
    try {
      await vi.waitFor(() => expect(httpServer.listening).toBe(false), { timeout: 250 });
    } finally {
      saveCompleted.resolve({
        status: "saved",
        lastSavedAt: new Date("2026-09-11T00:00:02.000Z"),
      });
      await closePromise;
    }
  });
});
