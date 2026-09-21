import { WHITEBOARD_LIMITS } from "@/realtime/whiteboard-limits";
import type {
  WhiteboardPresenceUpdatePayload,
  WhiteboardSceneUpdatePayload,
} from "@/realtime/whiteboard-protocol.schema";
import { WhiteboardScene, WhiteboardSceneLimitError } from "@/realtime/whiteboard-scene";
import type {
  SaveWhiteboardDocumentContentInput,
  SaveWhiteboardDocumentContentResult,
} from "@/services/whiteboard-document-content.service";
import type {
  WhiteboardElement,
  WhiteboardFileUpdates,
  WhiteboardSnapshot,
} from "@/types/whiteboard";

const QUIET_SAVE_DELAY_MS = 500;
const MAX_SAVE_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 10_000;
const DRAIN_RETRY_MAX_DELAY_MS = 2_000;
const RECENT_UPDATE_LIMIT = 1_000;
const CONFLICT_BLOCK_THRESHOLD = 3;
const FAILURE_BLOCK_THRESHOLD = 5;

type TimerHandle = ReturnType<typeof setTimeout>;

export type PersistenceState =
  "clean" | "dirty" | "saving" | "retrying" | "blocked" | "deleted" | "failed";

export interface ParticipantIdentity {
  userId: string;
  name: string;
}

export interface WhiteboardParticipant extends ParticipantIdentity {
  presenceIndex: number;
  cursor: { x: number; y: number } | null;
  activeElementIds: string[];
}

interface RoomLogger {
  info: (details: Record<string, unknown>, message: string) => void;
  warn: (details: Record<string, unknown>, message: string) => void;
  error: (details: Record<string, unknown>, message: string) => void;
}

const noopLogger: RoomLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export interface WhiteboardRoomManagerDependencies {
  loadSnapshot: (documentId: string) => Promise<WhiteboardSnapshot>;
  saveSnapshot: (
    input: SaveWhiteboardDocumentContentInput,
  ) => Promise<SaveWhiteboardDocumentContentResult>;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
  random?: () => number;
  now?: () => number;
  logger?: RoomLogger;
  onRoomEvent?: (event: WhiteboardRoomEvent) => void | Promise<void>;
}

export type WhiteboardRoomEvent =
  | {
      status: "scene_updated";
      documentId: string;
      sourceUserId: string;
      clientUpdateId: string;
      revision: number;
      elements: WhiteboardElement[];
      fileUpdates?: WhiteboardFileUpdates;
    }
  | { status: "saved"; documentId: string; revision: number; lastSavedAt: Date }
  | {
      status: "sync_required";
      documentId: string;
      revision: number;
      snapshot: WhiteboardSnapshot;
      savedRevision: number;
      persistenceState: PersistenceState;
    }
  | {
      status: "save_failed";
      documentId: string;
      revision: number;
      code: "PERSISTENCE_UNAVAILABLE";
    }
  | { status: "recovered"; documentId: string; revision: number }
  | {
      status: "deleted";
      documentId: string;
      revision: number;
      code: "DOCUMENT_NOT_FOUND";
      socketIds: string[];
    }
  | {
      status: "failed";
      documentId: string;
      revision: number;
      code: "CONTENT_INTEGRITY_ERROR";
      socketIds: string[];
    };

export type JoinRoomResult =
  | {
      status: "joined";
      documentId: string;
      snapshot: WhiteboardSnapshot;
      savedRevision: number;
      persistenceState: PersistenceState;
      participants: WhiteboardParticipant[];
      participant: WhiteboardParticipant;
      participantJoined: boolean;
    }
  | {
      status:
        | "room_capacity_exceeded"
        | "room_socket_capacity_exceeded"
        | "server_draining"
        | "content_integrity_error";
      documentId: string;
    };

type SuccessfulSceneUpdateResult = {
  status: "updated" | "duplicate" | "noop";
  documentId: string;
  sourceUserId: string;
  clientUpdateId: string;
  revision: number;
  appliedElements: WhiteboardElement[];
  savedRevision: number;
  fileUpdates?: WhiteboardFileUpdates;
};

export type SceneUpdateResult =
  | SuccessfulSceneUpdateResult
  | {
      status:
        | "document_room_mismatch"
        | "not_joined"
        | "persistence_unavailable"
        | "server_draining"
        | "room_size_limit_exceeded";
      documentId: string;
      clientUpdateId: string;
    }
  | {
      status: "file_version_conflict";
      documentId: string;
      clientUpdateId: string;
      fileId: string;
    };

export type PresenceUpdateResult =
  | { status: "updated"; documentId: string; participant: WhiteboardParticipant }
  | { status: "document_room_mismatch" | "not_joined"; documentId: string };

export type LeaveRoomResult = {
  documentId: string;
  userId: string;
  participantLeft: boolean;
  roomEmpty: boolean;
};

export type CloseDocumentResult = { documentId: string; socketIds: string[] };

export interface DirtyWhiteboardRoom {
  documentId: string;
  revision: number;
}

export class WhiteboardDrainError extends Error {
  readonly dirtyRooms: DirtyWhiteboardRoom[];

  constructor(dirtyRooms: DirtyWhiteboardRoom[]) {
    super("Whiteboard rooms could not be persisted before the shutdown deadline");
    this.name = "WhiteboardDrainError";
    this.dirtyRooms = dirtyRooms;
  }
}

interface ParticipantState extends WhiteboardParticipant {
  socketIds: Set<string>;
}

interface RoomState {
  documentId: string;
  scene: WhiteboardScene;
  persistenceState: PersistenceState;
  nextPresenceIndex: number;
  participants: Map<string, ParticipantState>;
  recentUpdates: Map<string, SuccessfulSceneUpdateResult>;
  quietSaveTimer?: TimerHandle;
  maxSaveTimer?: TimerHandle;
  retrySaveTimer?: TimerHandle;
  retryAttempt: number;
  conflictAttempts: number;
  failureAttempts: number;
  savePromise?: Promise<void>;
  closed: boolean;
}

function toParticipant(participant: ParticipantState): WhiteboardParticipant {
  return {
    userId: participant.userId,
    name: participant.name,
    presenceIndex: participant.presenceIndex,
    cursor: participant.cursor ? { ...participant.cursor } : null,
    activeElementIds: [...participant.activeElementIds],
  };
}

function toRoomParticipant(identity: ParticipantIdentity, presenceIndex: number): ParticipantState {
  return {
    ...identity,
    presenceIndex,
    cursor: null,
    activeElementIds: [],
    socketIds: new Set(),
  };
}

export class WhiteboardRoomManager {
  private readonly rooms = new Map<string, RoomState>();
  private readonly socketToDocument = new Map<string, string>();
  private readonly socketToUser = new Map<string, string>();
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly random: () => number;
  private readonly now: () => number;
  private readonly logger: RoomLogger;
  private isDraining = false;
  private closePromise?: Promise<void>;

  constructor(private readonly dependencies: WhiteboardRoomManagerDependencies) {
    this.setTimeoutFn = dependencies.setTimeout ?? setTimeout;
    this.clearTimeoutFn = dependencies.clearTimeout ?? clearTimeout;
    this.random = dependencies.random ?? Math.random;
    this.now = dependencies.now ?? Date.now;
    this.logger = dependencies.logger ?? noopLogger;
  }

  async join(
    socketId: string,
    identity: ParticipantIdentity,
    documentId: string,
    initial: WhiteboardSnapshot,
  ): Promise<JoinRoomResult> {
    if (this.isDraining) {
      return { status: "server_draining", documentId };
    }

    const targetRoom = this.rooms.get(documentId);
    if (targetRoom) {
      const alreadyJoined = this.socketToDocument.get(socketId) === documentId;
      const socketCount = this.roomSocketCount(targetRoom);
      if (!alreadyJoined && socketCount >= WHITEBOARD_LIMITS.socketsPerRoom) {
        return { status: "room_socket_capacity_exceeded", documentId };
      }
      if (
        !targetRoom.participants.has(identity.userId) &&
        targetRoom.participants.size >= WHITEBOARD_LIMITS.participantsPerRoom
      ) {
        return { status: "room_capacity_exceeded", documentId };
      }
    }

    let initialScene: WhiteboardScene | undefined;
    if (!targetRoom) {
      try {
        initialScene = WhiteboardScene.fromSnapshot(initial);
      } catch (error) {
        if (error instanceof WhiteboardSceneLimitError) {
          return { status: "content_integrity_error", documentId };
        }
        throw error;
      }
    }

    const joinedDocumentId = this.socketToDocument.get(socketId);
    if (joinedDocumentId && joinedDocumentId !== documentId) {
      this.leave(socketId);
    }

    let room = targetRoom;
    if (!room) {
      if (!initialScene) {
        throw new Error("Whiteboard scene was not initialized");
      }
      room = {
        documentId,
        scene: initialScene,
        persistenceState: "clean",
        nextPresenceIndex: 0,
        participants: new Map(),
        recentUpdates: new Map(),
        retryAttempt: 0,
        conflictAttempts: 0,
        failureAttempts: 0,
        closed: false,
      };
      this.rooms.set(documentId, room);
    }

    let participant = room.participants.get(identity.userId);
    const participantJoined = !participant;
    if (!participant) {
      participant = toRoomParticipant(identity, room.nextPresenceIndex++);
      room.participants.set(identity.userId, participant);
    }
    participant.socketIds.add(socketId);
    this.socketToDocument.set(socketId, documentId);
    this.socketToUser.set(socketId, identity.userId);

    return {
      status: "joined",
      documentId,
      snapshot: room.scene.toSnapshot(),
      savedRevision: room.scene.persistedRevision,
      persistenceState: room.persistenceState,
      participants: [...room.participants.values()].map(toParticipant),
      participant: toParticipant(participant),
      participantJoined,
    };
  }

  updateScene(socketId: string, input: WhiteboardSceneUpdatePayload): SceneUpdateResult {
    if (this.isDraining) {
      return this.sceneError("server_draining", input);
    }

    const joinedDocumentId = this.socketToDocument.get(socketId);
    if (!joinedDocumentId) {
      return this.sceneError("not_joined", input);
    }
    if (joinedDocumentId !== input.documentId) {
      return this.sceneError("document_room_mismatch", input);
    }

    const room = this.rooms.get(input.documentId);
    const userId = this.socketToUser.get(socketId);
    if (!room || !userId) {
      return this.sceneError("not_joined", input);
    }
    if (room.persistenceState === "blocked") {
      return this.sceneError("persistence_unavailable", input);
    }

    const updateKey = `${userId}:${input.clientUpdateId}`;
    const cached = room.recentUpdates.get(updateKey);
    if (cached) {
      return { ...cached, status: "duplicate" };
    }

    const applied = room.scene.applyUpdate({
      elements: input.elements,
      fileUpdates: input.fileUpdates,
    });
    if (applied.status === "file_conflict") {
      return {
        status: "file_version_conflict",
        documentId: input.documentId,
        clientUpdateId: input.clientUpdateId,
        fileId: applied.fileId,
      };
    }
    if (applied.status === "room_size_limit_exceeded") {
      return this.sceneError("room_size_limit_exceeded", input);
    }

    const result: SuccessfulSceneUpdateResult = {
      status: applied.status,
      documentId: input.documentId,
      sourceUserId: userId,
      clientUpdateId: input.clientUpdateId,
      revision: applied.revision,
      appliedElements: applied.status === "updated" ? applied.elements : [],
      savedRevision: room.scene.persistedRevision,
      ...(applied.status === "updated" && applied.fileUpdates
        ? { fileUpdates: applied.fileUpdates }
        : {}),
    };
    this.rememberUpdate(room, updateKey, result);

    if (applied.status === "updated") {
      room.persistenceState = room.savePromise ? "saving" : "dirty";
      this.scheduleSave(room);
      void this.emitRoomEvent({
        status: "scene_updated",
        documentId: room.documentId,
        sourceUserId: userId,
        clientUpdateId: input.clientUpdateId,
        revision: applied.revision,
        elements: applied.elements,
        ...(applied.fileUpdates ? { fileUpdates: applied.fileUpdates } : {}),
      });
    }

    return result;
  }

  updatePresence(socketId: string, input: WhiteboardPresenceUpdatePayload): PresenceUpdateResult {
    const joinedDocumentId = this.socketToDocument.get(socketId);
    if (!joinedDocumentId) {
      return { status: "not_joined", documentId: input.documentId };
    }
    if (joinedDocumentId !== input.documentId) {
      return { status: "document_room_mismatch", documentId: input.documentId };
    }
    const room = this.rooms.get(input.documentId);
    const userId = this.socketToUser.get(socketId);
    const participant = userId ? room?.participants.get(userId) : undefined;
    if (!room || !participant) {
      return { status: "not_joined", documentId: input.documentId };
    }

    participant.cursor = input.cursor ? { ...input.cursor } : null;
    participant.activeElementIds = [...input.activeElementIds];
    return {
      status: "updated",
      documentId: input.documentId,
      participant: toParticipant(participant),
    };
  }

  leave(socketId: string): LeaveRoomResult | null {
    const documentId = this.socketToDocument.get(socketId);
    const userId = this.socketToUser.get(socketId);
    if (!documentId || !userId) {
      return null;
    }
    this.socketToDocument.delete(socketId);
    this.socketToUser.delete(socketId);

    const room = this.rooms.get(documentId);
    const participant = room?.participants.get(userId);
    if (!room || !participant) {
      return null;
    }
    participant.socketIds.delete(socketId);
    const participantLeft = participant.socketIds.size === 0;
    if (participantLeft) {
      room.participants.delete(userId);
    }
    const roomEmpty = room.participants.size === 0;
    if (roomEmpty) {
      if (this.isDirty(room) || room.savePromise) {
        void this.flushRoom(room);
      } else {
        this.rooms.delete(documentId);
      }
    }
    return { documentId, userId, participantLeft, roomEmpty };
  }

  closeDocument(documentId: string): CloseDocumentResult | null {
    const room = this.rooms.get(documentId);
    if (!room) {
      return null;
    }
    const socketIds = this.roomSocketIds(room);
    room.persistenceState = "deleted";
    room.closed = true;
    this.removeRoom(room, socketIds);
    return { documentId, socketIds };
  }

  close(options: { deadlineAt?: number } = {}): Promise<void> {
    if (this.closePromise) {
      return this.closePromise;
    }
    this.isDraining = true;
    for (const room of this.rooms.values()) {
      this.clearSaveTimers(room);
    }
    this.closePromise = this.drain(options.deadlineAt ?? Number.POSITIVE_INFINITY);
    return this.closePromise;
  }

  private async drain(deadlineAt: number): Promise<void> {
    const rooms = [...this.rooms.values()];
    await Promise.all(rooms.map((room) => this.drainRoom(room, deadlineAt)));
    const dirtyRooms = rooms
      .filter((room) => this.rooms.get(room.documentId) === room && this.isDirty(room))
      .map((room) => ({ documentId: room.documentId, revision: room.scene.revision }));
    if (dirtyRooms.length > 0) {
      this.logger.error({ dirtyRooms }, "Whiteboard drain deadline exceeded");
      throw new WhiteboardDrainError(dirtyRooms);
    }
    for (const room of rooms) {
      this.clearSaveTimers(room);
    }
    this.rooms.clear();
    this.socketToDocument.clear();
    this.socketToUser.clear();
  }

  private async drainRoom(room: RoomState, deadlineAt: number): Promise<void> {
    while (this.rooms.get(room.documentId) === room && this.isDirty(room)) {
      if (this.now() >= deadlineAt) {
        return;
      }
      if (room.savePromise) {
        const completed = await this.waitUntil(room.savePromise, deadlineAt);
        if (!completed) {
          return;
        }
        continue;
      }
      await this.flushRoom(room);
      if (!this.isDirty(room) || this.rooms.get(room.documentId) !== room) {
        return;
      }
      const remaining = deadlineAt - this.now();
      if (remaining <= 0) {
        return;
      }
      await this.wait(Math.min(this.nextRetryDelay(room), DRAIN_RETRY_MAX_DELAY_MS, remaining));
    }
  }

  private async waitUntil(promise: Promise<void>, deadlineAt: number): Promise<boolean> {
    if (!Number.isFinite(deadlineAt)) {
      await promise;
      return true;
    }
    const remaining = deadlineAt - this.now();
    if (remaining <= 0) {
      return false;
    }
    let timer: TimerHandle | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = this.setTimeoutFn(() => resolve(false), remaining);
    });
    const completed = promise.then(() => true as const);
    const result = await Promise.race([completed, timedOut]);
    if (timer) {
      this.clearTimeoutFn(timer);
    }
    return result;
  }

  private wait(delay: number): Promise<void> {
    return new Promise((resolve) => this.setTimeoutFn(resolve, delay));
  }

  private scheduleSave(room: RoomState): void {
    if (room.closed || this.isDraining) {
      return;
    }
    if (room.retrySaveTimer) {
      this.clearTimeoutFn(room.retrySaveTimer);
      room.retrySaveTimer = undefined;
    }
    if (room.quietSaveTimer) {
      this.clearTimeoutFn(room.quietSaveTimer);
    }
    room.quietSaveTimer = this.setTimeoutFn(() => {
      room.quietSaveTimer = undefined;
      void this.flushRoom(room);
    }, QUIET_SAVE_DELAY_MS);
    if (!room.maxSaveTimer) {
      room.maxSaveTimer = this.setTimeoutFn(() => {
        room.maxSaveTimer = undefined;
        void this.flushRoom(room);
      }, MAX_SAVE_DELAY_MS);
    }
  }

  private scheduleRetry(room: RoomState): void {
    if (room.closed || this.isDraining || !this.isDirty(room) || room.retrySaveTimer) {
      return;
    }
    const delay = this.nextRetryDelay(room);
    if (room.persistenceState !== "blocked") {
      room.persistenceState = "retrying";
    }
    this.logger.warn(
      {
        documentId: room.documentId,
        persistenceState: room.persistenceState,
        revision: room.scene.revision,
        persistedRevision: room.scene.persistedRevision,
        retryDelay: delay,
      },
      "Whiteboard save retry scheduled",
    );
    room.retrySaveTimer = this.setTimeoutFn(() => {
      room.retrySaveTimer = undefined;
      void this.flushRoom(room);
    }, delay);
  }

  private nextRetryDelay(room: RoomState): number {
    const cap = Math.min(500 * 2 ** room.retryAttempt, RETRY_MAX_DELAY_MS);
    room.retryAttempt += 1;
    const sample = Math.max(0, Math.min(this.random(), 1 - Number.EPSILON));
    return Math.floor(sample * (cap + 1));
  }

  private async flushRoom(room: RoomState): Promise<void> {
    if (room.savePromise) {
      await room.savePromise;
      return;
    }
    if (room.closed || !this.isDirty(room)) {
      this.cleanupEmptyRoom(room);
      return;
    }
    this.clearSaveTimers(room);
    const operation = this.performSave(room).finally(() => {
      if (room.savePromise === operation) {
        room.savePromise = undefined;
      }
      this.cleanupEmptyRoom(room);
    });
    room.savePromise = operation;
    await operation;
  }

  private async performSave(room: RoomState): Promise<void> {
    const wasBlocked = room.persistenceState === "blocked";
    if (!wasBlocked) {
      room.persistenceState = "saving";
    }
    const snapshot = room.scene.toSnapshot();
    const input: SaveWhiteboardDocumentContentInput = {
      documentId: room.documentId,
      canvasContent: snapshot.canvasContent,
      expectedRevision: room.scene.persistedRevision,
      revision: snapshot.revision,
    };

    try {
      const result = await this.dependencies.saveSnapshot(input);
      await this.handleSaveResult(room, snapshot.revision, result, wasBlocked);
    } catch (error) {
      await this.handleTransientFailure(room, snapshot.revision, error);
    }
  }

  private async handleSaveResult(
    room: RoomState,
    savedRevision: number,
    result: SaveWhiteboardDocumentContentResult,
    wasBlocked: boolean,
  ): Promise<void> {
    if (room.closed) {
      return;
    }
    if (result.status === "saved") {
      room.scene.setPersisted(result.lastSavedAt, savedRevision);
      room.conflictAttempts = 0;
      room.failureAttempts = 0;
      room.retryAttempt = 0;
      room.persistenceState = this.isDirty(room) ? "dirty" : "clean";
      await this.emitRoomEvent({
        status: "saved",
        documentId: room.documentId,
        revision: savedRevision,
        lastSavedAt: result.lastSavedAt,
      });
      if (wasBlocked) {
        await this.emitRoomEvent({
          status: "recovered",
          documentId: room.documentId,
          revision: room.scene.revision,
        });
      }
      if (this.isDirty(room)) {
        this.scheduleSave(room);
      }
      return;
    }
    if (result.status === "not_found") {
      await this.terminateRoom(room, "deleted");
      return;
    }
    if (result.status === "content_missing") {
      await this.terminateRoom(room, "failed");
      return;
    }

    room.conflictAttempts += 1;
    room.failureAttempts = 0;
    try {
      const latest = await this.dependencies.loadSnapshot(room.documentId);
      const merged = room.scene.mergeSnapshot(latest);
      await this.emitRoomEvent({
        status: "sync_required",
        documentId: room.documentId,
        revision: merged.snapshot.revision,
        snapshot: merged.snapshot,
        savedRevision: room.scene.persistedRevision,
        persistenceState: room.persistenceState,
      });
    } catch (error) {
      if (error instanceof WhiteboardSceneLimitError) {
        await this.terminateRoom(room, "failed");
        return;
      }
      await this.handleTransientFailure(room, savedRevision, error);
      return;
    }

    if (room.conflictAttempts >= CONFLICT_BLOCK_THRESHOLD) {
      await this.blockRoom(room);
    } else if (room.persistenceState !== "blocked") {
      room.persistenceState = "retrying";
    }
    this.scheduleRetry(room);
  }

  private async handleTransientFailure(
    room: RoomState,
    revision: number,
    error: unknown,
  ): Promise<void> {
    if (room.closed) {
      return;
    }
    room.failureAttempts += 1;
    room.conflictAttempts = 0;
    this.logger.warn(
      {
        documentId: room.documentId,
        persistenceState: room.persistenceState,
        revision,
        persistedRevision: room.scene.persistedRevision,
        failureAttempt: room.failureAttempts,
        errorName: error instanceof Error ? error.name : "UnknownError",
      },
      "Whiteboard save failed",
    );
    if (room.failureAttempts >= FAILURE_BLOCK_THRESHOLD) {
      await this.blockRoom(room);
    } else if (room.persistenceState !== "blocked") {
      room.persistenceState = "retrying";
    }
    this.scheduleRetry(room);
  }

  private async blockRoom(room: RoomState): Promise<void> {
    if (room.persistenceState === "blocked") {
      return;
    }
    room.persistenceState = "blocked";
    this.logger.error(
      {
        documentId: room.documentId,
        persistenceState: room.persistenceState,
        revision: room.scene.revision,
        persistedRevision: room.scene.persistedRevision,
      },
      "Whiteboard room persistence blocked",
    );
    await this.emitRoomEvent({
      status: "save_failed",
      documentId: room.documentId,
      revision: room.scene.revision,
      code: "PERSISTENCE_UNAVAILABLE",
    });
  }

  private async terminateRoom(room: RoomState, status: "deleted" | "failed"): Promise<void> {
    room.persistenceState = status;
    room.closed = true;
    const socketIds = this.roomSocketIds(room);
    if (status === "deleted") {
      await this.emitRoomEvent({
        status,
        documentId: room.documentId,
        revision: room.scene.revision,
        code: "DOCUMENT_NOT_FOUND",
        socketIds,
      });
    } else {
      await this.emitRoomEvent({
        status,
        documentId: room.documentId,
        revision: room.scene.revision,
        code: "CONTENT_INTEGRITY_ERROR",
        socketIds,
      });
    }
    this.removeRoom(room, socketIds);
  }

  private removeRoom(room: RoomState, socketIds = this.roomSocketIds(room)): void {
    this.clearSaveTimers(room);
    for (const socketId of socketIds) {
      this.socketToDocument.delete(socketId);
      this.socketToUser.delete(socketId);
    }
    if (this.rooms.get(room.documentId) === room) {
      this.rooms.delete(room.documentId);
    }
  }

  private clearSaveTimers(room: RoomState): void {
    for (const key of ["quietSaveTimer", "maxSaveTimer", "retrySaveTimer"] as const) {
      const timer = room[key];
      if (timer) {
        this.clearTimeoutFn(timer);
        room[key] = undefined;
      }
    }
  }

  private cleanupEmptyRoom(room: RoomState): void {
    if (
      room.participants.size === 0 &&
      !this.isDirty(room) &&
      !room.savePromise &&
      this.rooms.get(room.documentId) === room
    ) {
      this.rooms.delete(room.documentId);
    }
  }

  private isDirty(room: RoomState): boolean {
    return room.scene.persistedRevision !== room.scene.revision;
  }

  private roomSocketIds(room: RoomState): string[] {
    return [...room.participants.values()].flatMap((participant) => [...participant.socketIds]);
  }

  private roomSocketCount(room: RoomState): number {
    return this.roomSocketIds(room).length;
  }

  private rememberUpdate(room: RoomState, key: string, result: SuccessfulSceneUpdateResult): void {
    room.recentUpdates.set(key, result);
    if (room.recentUpdates.size > RECENT_UPDATE_LIMIT) {
      const oldestKey = room.recentUpdates.keys().next().value;
      if (oldestKey) {
        room.recentUpdates.delete(oldestKey);
      }
    }
  }

  private sceneError(
    status:
      | "document_room_mismatch"
      | "not_joined"
      | "persistence_unavailable"
      | "server_draining"
      | "room_size_limit_exceeded",
    input: WhiteboardSceneUpdatePayload,
  ): SceneUpdateResult {
    return { status, documentId: input.documentId, clientUpdateId: input.clientUpdateId };
  }

  private async emitRoomEvent(event: WhiteboardRoomEvent): Promise<void> {
    if (!this.dependencies.onRoomEvent) {
      return;
    }
    try {
      await this.dependencies.onRoomEvent(event);
    } catch {
      // Transport notification failures must not break the persistence loop.
    }
  }
}
