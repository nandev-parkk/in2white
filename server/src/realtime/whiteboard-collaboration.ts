import type { IncomingMessage, Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { ipKeyGenerator } from "express-rate-limit";
import { ERROR_MESSAGES } from "@/constants/messages";
import { getEnv } from "@/config/env";
import { verifyAccessToken } from "@/lib/jwt";
import { WhiteboardDocumentLifecycle } from "@/realtime/whiteboard-document-lifecycle";
import { WHITEBOARD_LIMITS } from "@/realtime/whiteboard-limits";
import {
  whiteboardJoinPayloadSchema,
  whiteboardPresenceUpdatePayloadSchema,
  whiteboardSceneUpdatePayloadSchema,
  type WhiteboardJoinPayload,
} from "@/realtime/whiteboard-protocol.schema";
import { TokenBucket } from "@/realtime/whiteboard-rate-limiter";
import {
  type ParticipantIdentity,
  WhiteboardRoomManager,
  type SceneUpdateResult,
  type WhiteboardRealtimeStats,
  type WhiteboardRoomEvent,
} from "@/realtime/whiteboard-room-manager";
import type {
  WhiteboardClientToServerEvents,
  WhiteboardInterServerEvents,
  WhiteboardJoinAck,
  WhiteboardProtocolError,
  WhiteboardSceneAck,
  WhiteboardServerToClientEvents,
  WhiteboardSocketData,
} from "@/realtime/whiteboard-socket.events";
import {
  getWhiteboardDocumentContent,
  saveWhiteboardDocumentContent,
} from "@/services/whiteboard-document-content.service";
import {
  getWhiteboardDocument,
  type WhiteboardDocumentDetail,
} from "@/services/whiteboard-document.service";
import { getUserById } from "@/services/user.service";
import type { WhiteboardSnapshot } from "@/types/whiteboard";
import { HttpError } from "@/utils/http-error";
import { logger } from "@/utils/logger";

const ROOM_PREFIX = "whiteboard:document:";
const PRESENCE_ERROR_COOLDOWN_MS = 1_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_KEYS = 10_000;

interface FixedWindowEntry {
  count: number;
  resetAt: number;
}

function consumeFixedWindow(
  buckets: Map<string, FixedWindowEntry>,
  key: string,
  limit: number,
  now: number,
): boolean {
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= MAX_RATE_LIMIT_KEYS) {
      for (const [staleKey, staleBucket] of buckets) {
        if (staleBucket.resetAt <= now) buckets.delete(staleKey);
      }
    }
    if (buckets.size >= MAX_RATE_LIMIT_KEYS) return false;
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    buckets.set(key, bucket);
  } else if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function socketClientIp(request: IncomingMessage, trustedProxyHops: number): string {
  const remoteAddress = request.socket.remoteAddress || "unknown";
  if (trustedProxyHops === 0) return ipKeyGenerator(remoteAddress);

  const forwarded = request.headers["x-forwarded-for"];
  const forwardedAddresses = (Array.isArray(forwarded) ? forwarded.join(",") : (forwarded ?? ""))
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
  if (forwardedAddresses.length === 0) return ipKeyGenerator(remoteAddress);

  const clientIndex = Math.max(0, forwardedAddresses.length - trustedProxyHops);
  return ipKeyGenerator(forwardedAddresses[clientIndex] ?? remoteAddress);
}

type WhiteboardIo = Server<
  WhiteboardClientToServerEvents,
  WhiteboardServerToClientEvents,
  WhiteboardInterServerEvents,
  WhiteboardSocketData
>;

type WhiteboardSocket = Socket<
  WhiteboardClientToServerEvents,
  WhiteboardServerToClientEvents,
  WhiteboardInterServerEvents,
  WhiteboardSocketData
>;

function roomName(documentId: string): string {
  return `${ROOM_PREFIX}${documentId}`;
}

function toSnapshot(document: WhiteboardDocumentDetail): WhiteboardSnapshot {
  return {
    canvasContent: document.canvasContent,
    revision: document.revision,
    lastSavedAt: document.lastSavedAt,
  };
}

function toWhiteboardDocumentResponse(
  document: WhiteboardDocumentDetail,
  snapshot: WhiteboardSnapshot,
) {
  return {
    id: document.id,
    projectId: document.projectId,
    name: document.name,
    canvasContent: snapshot.canvasContent,
    revision: snapshot.revision,
    lastSavedAt: snapshot.lastSavedAt.toISOString(),
  };
}

function sendAck<T>(ack: ((response: T) => void) | undefined, response: T): void {
  if (typeof ack === "function") {
    ack(response);
  }
}

function protocolError(
  code: WhiteboardProtocolError["code"],
  message: string,
): { ok: false; error: WhiteboardProtocolError } {
  return { ok: false, error: { code, message } };
}

function errorMessage(error: unknown): string {
  return error instanceof HttpError ? error.message : ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
}

function errorCode(error: unknown): WhiteboardProtocolError["code"] {
  if (error instanceof HttpError && isProtocolErrorCode(error.code)) {
    return error.code;
  }
  return "INTERNAL_SERVER_ERROR";
}

function isProtocolErrorCode(code: string): code is WhiteboardProtocolError["code"] {
  switch (code) {
    case "UNAUTHORIZED":
    case "AUTH_EXPIRED":
    case "INVALID_PAYLOAD":
    case "PAYLOAD_TOO_LARGE":
    case "RATE_LIMITED":
    case "NOT_JOINED":
    case "DOCUMENT_ROOM_MISMATCH":
    case "ROOM_CAPACITY_EXCEEDED":
    case "ROOM_SOCKET_CAPACITY_EXCEEDED":
    case "ROOM_SIZE_LIMIT_EXCEEDED":
    case "FILE_VERSION_CONFLICT":
    case "PERSISTENCE_UNAVAILABLE":
    case "SERVER_DRAINING":
    case "CONTENT_INTEGRITY_ERROR":
    case "WHITEBOARD_DOCUMENT_NOT_FOUND":
    case "WORKSPACE_NOT_FOUND":
    case "PROJECT_NOT_FOUND":
    case "INTERNAL_SERVER_ERROR":
      return true;
    default:
      return false;
  }
}

function socketError(
  code: WhiteboardProtocolError["code"],
  message: string,
): Error & { data: WhiteboardProtocolError } {
  return Object.assign(new Error(message), { data: { code, message } });
}

function payloadBytes(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : Buffer.byteLength(serialized, "utf8");
  } catch {
    return null;
  }
}

export interface AuthorizedWhiteboardJoin {
  whiteboardDocument: WhiteboardDocumentDetail;
  participant: ParticipantIdentity;
}

export interface WhiteboardCollaborationDependencies {
  authorizeJoin: (input: {
    workspaceId: string;
    projectId: string;
    documentId: string;
    userId: string;
  }) => Promise<AuthorizedWhiteboardJoin>;
  saveSnapshot: typeof saveWhiteboardDocumentContent;
  loadSnapshot: typeof getWhiteboardDocumentContent;
  verifyToken: typeof verifyAccessToken;
  now: () => number;
  random: () => number;
  shutdownDeadlineAt: () => number;
}

export interface WhiteboardCollaboration {
  documentDeleted(documentId: string): void;
  /** 어드민 운영 화면이 현재 열린 방·참여자·소켓 수를 읽는다. */
  stats(): WhiteboardRealtimeStats;
  close(): Promise<void>;
}

function createDefaultDependencies(): WhiteboardCollaborationDependencies {
  return {
    authorizeJoin: async ({ workspaceId, projectId, documentId, userId }) => {
      const [whiteboardDocument, user] = await Promise.all([
        getWhiteboardDocument({ workspaceId, projectId, documentId, userId }),
        getUserById(userId),
      ]);
      if (!user) {
        throw new HttpError(401, "UNAUTHORIZED", ERROR_MESSAGES.INVALID_ACCESS_TOKEN);
      }
      return {
        whiteboardDocument,
        participant: { userId: user.id, name: user.name },
      };
    },
    saveSnapshot: saveWhiteboardDocumentContent,
    loadSnapshot: getWhiteboardDocumentContent,
    verifyToken: verifyAccessToken,
    now: Date.now,
    random: Math.random,
    shutdownDeadlineAt: () => Number.POSITIVE_INFINITY,
  };
}

export function createWhiteboardCollaborationServer(
  httpServer: HttpServer,
  providedDependencies?: Partial<WhiteboardCollaborationDependencies>,
): WhiteboardCollaboration {
  const dependencies = { ...createDefaultDependencies(), ...providedDependencies };
  const lifecycle = new WhiteboardDocumentLifecycle();
  const trustedProxyHops = getEnv().TRUST_PROXY_HOPS;
  const handshakeAttempts = new Map<string, FixedWindowEntry>();
  const authenticationFailures = new Map<string, FixedWindowEntry>();
  const sessionConnectionAttempts = new Map<string, FixedWindowEntry>();
  const activeSessionSockets = new Map<string, number>();
  const io: WhiteboardIo = new Server(httpServer, {
    cors: { origin: getEnv().CORS_ORIGIN, credentials: true },
    maxHttpBufferSize: WHITEBOARD_LIMITS.transportPayloadBytes,
    allowRequest: (request, callback) => {
      const clientIp = socketClientIp(request, trustedProxyHops);
      const allowed = consumeFixedWindow(
        handshakeAttempts,
        clientIp,
        WHITEBOARD_LIMITS.handshakesPerIpPerMinute,
        dependencies.now(),
      );
      callback(null, allowed);
    },
  });

  let closePromise: Promise<void> | undefined;

  const disconnectSockets = (
    socketIds: string[],
    event?: { name: "whiteboard:document:deleted"; documentId: string },
  ): void => {
    for (const socketId of socketIds) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) {
        continue;
      }
      if (event) {
        socket.emit(event.name, { documentId: event.documentId });
      }
      socket.disconnect(true);
    }
  };

  const handleRoomEvent = async (event: WhiteboardRoomEvent): Promise<void> => {
    const target = io.to(roomName(event.documentId));
    if (event.status === "scene_updated") {
      return;
    }
    if (event.status === "saved") {
      target.emit("whiteboard:scene:saved", {
        documentId: event.documentId,
        revision: event.revision,
        lastSavedAt: event.lastSavedAt.toISOString(),
      });
      return;
    }
    if (event.status === "sync_required") {
      target.emit("whiteboard:sync:required", {
        documentId: event.documentId,
        savedRevision: event.savedRevision,
        persistenceState: event.persistenceState,
        snapshot: {
          canvasContent: event.snapshot.canvasContent,
          revision: event.snapshot.revision,
          lastSavedAt: event.snapshot.lastSavedAt.toISOString(),
        },
      });
      return;
    }
    if (event.status === "save_failed") {
      target.emit("whiteboard:scene:save-failed", {
        documentId: event.documentId,
        revision: event.revision,
        code: event.code,
        message: "화이트보드 변경사항을 저장할 수 없습니다",
      });
      return;
    }
    if (event.status === "recovered") {
      target.emit("whiteboard:room:recovered", {
        documentId: event.documentId,
        revision: event.revision,
      });
      return;
    }
    if (event.status === "deleted") {
      lifecycle.documentDeleted(event.documentId);
      disconnectSockets(event.socketIds, {
        name: "whiteboard:document:deleted",
        documentId: event.documentId,
      });
      return;
    }

    target.emit("whiteboard:scene:save-failed", {
      documentId: event.documentId,
      revision: event.revision,
      code: "CONTENT_INTEGRITY_ERROR",
      message: ERROR_MESSAGES.CONTENT_INTEGRITY_ERROR,
    });
    disconnectSockets(event.socketIds);
  };

  const manager = new WhiteboardRoomManager({
    loadSnapshot: dependencies.loadSnapshot,
    saveSnapshot: dependencies.saveSnapshot,
    onRoomEvent: handleRoomEvent,
    random: dependencies.random,
    now: dependencies.now,
    logger,
  });

  const documentDeleted = (documentId: string): void => {
    lifecycle.documentDeleted(documentId);
    const closed = manager.closeDocument(documentId);
    if (closed) {
      disconnectSockets(closed.socketIds, {
        name: "whiteboard:document:deleted",
        documentId,
      });
    }
  };

  io.use((socket, next) => {
    if (lifecycle.draining) {
      next(socketError("SERVER_DRAINING", "서버가 종료 중입니다"));
      return;
    }
    const accessToken =
      typeof socket.handshake.auth?.accessToken === "string"
        ? socket.handshake.auth.accessToken
        : undefined;
    if (!accessToken) {
      const clientIp = socketClientIp(socket.request, trustedProxyHops);
      const allowed = consumeFixedWindow(
        authenticationFailures,
        clientIp,
        WHITEBOARD_LIMITS.authFailuresPerIpPerMinute,
        dependencies.now(),
      );
      next(
        socketError(
          allowed ? "UNAUTHORIZED" : "RATE_LIMITED",
          allowed
            ? ERROR_MESSAGES.MISSING_BEARER_TOKEN
            : "연결 요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
        ),
      );
      return;
    }

    void dependencies
      .verifyToken(accessToken)
      .then((user) => {
        if (lifecycle.draining) {
          next(socketError("SERVER_DRAINING", "서버가 종료 중입니다"));
          return;
        }
        const sessionKey = `${user.sub}:${user.sid}`;
        if (
          !consumeFixedWindow(
            sessionConnectionAttempts,
            sessionKey,
            WHITEBOARD_LIMITS.connectionsPerSessionPerMinute,
            dependencies.now(),
          )
        ) {
          next(
            socketError(
              "RATE_LIMITED",
              "세션 연결 요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
            ),
          );
          return;
        }

        const activeSockets = activeSessionSockets.get(sessionKey) ?? 0;
        if (activeSockets >= WHITEBOARD_LIMITS.socketsPerSession) {
          next(socketError("RATE_LIMITED", "이 세션의 동시 연결 수가 최대치에 도달했습니다"));
          return;
        }
        activeSessionSockets.set(sessionKey, activeSockets + 1);
        socket.once("disconnect", () => {
          const remaining = activeSessionSockets.get(sessionKey) ?? 0;
          if (remaining <= 1) activeSessionSockets.delete(sessionKey);
          else activeSessionSockets.set(sessionKey, remaining - 1);
        });

        socket.data.user = user;
        socket.data.joinBucket = new TokenBucket({
          ratePerSecond: WHITEBOARD_LIMITS.joinRatePerSecond,
          burst: WHITEBOARD_LIMITS.joinBurst,
          now: dependencies.now,
        });
        socket.data.sceneBucket = new TokenBucket({
          ratePerSecond: WHITEBOARD_LIMITS.sceneRatePerSecond,
          burst: WHITEBOARD_LIMITS.sceneBurst,
          now: dependencies.now,
        });
        socket.data.presenceBucket = new TokenBucket({
          ratePerSecond: WHITEBOARD_LIMITS.presenceRatePerSecond,
          burst: WHITEBOARD_LIMITS.presenceBurst,
          now: dependencies.now,
        });
        const expiresIn = user.exp * 1_000 - dependencies.now();
        socket.data.authExpiryTimer = setTimeout(
          () => {
            socket.emit("whiteboard:auth:expired", { code: "AUTH_EXPIRED" });
            socket.disconnect(true);
          },
          Math.max(0, expiresIn),
        );
        next();
      })
      .catch(() => {
        const clientIp = socketClientIp(socket.request, trustedProxyHops);
        const allowed = consumeFixedWindow(
          authenticationFailures,
          clientIp,
          WHITEBOARD_LIMITS.authFailuresPerIpPerMinute,
          dependencies.now(),
        );
        next(
          socketError(
            allowed ? "UNAUTHORIZED" : "RATE_LIMITED",
            allowed
              ? ERROR_MESSAGES.INVALID_ACCESS_TOKEN
              : "연결 요청이 너무 많습니다. 잠시 후 다시 시도해주세요",
          ),
        );
      });
  });

  io.on("connection", (socket) => {
    let joinQueue: Promise<void> = Promise.resolve();
    let disconnected = false;
    const presenceErrorAt = new Map<WhiteboardProtocolError["code"], number>();

    const presenceError = (error: WhiteboardProtocolError): void => {
      const now = dependencies.now();
      const lastSentAt = presenceErrorAt.get(error.code) ?? Number.NEGATIVE_INFINITY;
      if (now - lastSentAt < PRESENCE_ERROR_COOLDOWN_MS) {
        return;
      }
      presenceErrorAt.set(error.code, now);
      socket.emit("whiteboard:error", error);
    };

    const handleJoin = async (
      payload: WhiteboardJoinPayload,
      ack?: (response: WhiteboardJoinAck) => void,
    ): Promise<void> => {
      const ticket = lifecycle.beginJoin(payload.documentId);
      if ("status" in ticket) {
        sendAck(ack, protocolError("SERVER_DRAINING", "서버가 종료 중입니다"));
        return;
      }

      try {
        const authorized = await dependencies.authorizeJoin({
          ...payload,
          userId: socket.data.user.sub,
        });
        if (disconnected) {
          return;
        }

        const previousDocumentId = socket.data.currentDocumentId;
        const committed = lifecycle.commitJoin(ticket, () => {
          if (previousDocumentId && previousDocumentId !== payload.documentId) {
            leaveSocketRoom(manager, socket, previousDocumentId);
          }
          return manager.join(
            socket.id,
            authorized.participant,
            payload.documentId,
            toSnapshot(authorized.whiteboardDocument),
          );
        });
        if (committed.status !== "joined") {
          sendAck(
            ack,
            committed.status === "deleted"
              ? protocolError(
                  "WHITEBOARD_DOCUMENT_NOT_FOUND",
                  ERROR_MESSAGES.WHITEBOARD_DOCUMENT_NOT_FOUND,
                )
              : protocolError("SERVER_DRAINING", "서버가 종료 중입니다"),
          );
          return;
        }

        const joined = await committed.value;
        if (joined.status !== "joined") {
          const error = joinResultError(joined.status);
          sendAck(ack, { ok: false, error });
          return;
        }
        if (disconnected) {
          manager.leave(socket.id);
          return;
        }

        if (previousDocumentId && previousDocumentId !== payload.documentId) {
          await socket.leave(roomName(previousDocumentId));
        }
        await socket.join(roomName(payload.documentId));
        socket.data.currentDocumentId = payload.documentId;

        if (joined.participantJoined) {
          socket.to(roomName(payload.documentId)).emit("whiteboard:presence:joined", {
            documentId: payload.documentId,
            participant: joined.participant,
          });
        }
        sendAck(ack, {
          ok: true,
          whiteboardDocument: toWhiteboardDocumentResponse(
            authorized.whiteboardDocument,
            joined.snapshot,
          ),
          participants: joined.participants,
          savedRevision: joined.savedRevision,
          persistenceState: joined.persistenceState,
        });
      } catch (error) {
        sendAck(ack, protocolError(errorCode(error), errorMessage(error)));
      } finally {
        lifecycle.releaseJoin(ticket);
      }
    };

    socket.on("whiteboard:join", (rawPayload, ack) => {
      if (!socket.data.joinBucket.consume()) {
        sendAck(ack, protocolError("RATE_LIMITED", "화이트보드 참가 요청이 너무 많습니다"));
        return;
      }

      const parsed = whiteboardJoinPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        sendAck(
          ack,
          protocolError(
            "INVALID_PAYLOAD",
            parsed.error.issues[0]?.message ?? "잘못된 실시간 요청입니다",
          ),
        );
        return;
      }
      const queued = joinQueue.then(() => handleJoin(parsed.data, ack));
      joinQueue = queued.catch(() => undefined);
      void queued;
    });

    socket.on("whiteboard:scene:update", (rawPayload, ack) => {
      const size = payloadBytes(rawPayload);
      if (size === null) {
        sendAck(ack, protocolError("INVALID_PAYLOAD", "잘못된 실시간 요청입니다"));
        return;
      }
      if (size > WHITEBOARD_LIMITS.applicationPayloadBytes) {
        sendAck(ack, protocolError("PAYLOAD_TOO_LARGE", "실시간 요청 크기가 너무 큽니다"));
        return;
      }
      if (!socket.data.sceneBucket.consume()) {
        sendAck(ack, protocolError("RATE_LIMITED", "실시간 요청이 너무 많습니다"));
        return;
      }
      const parsed = whiteboardSceneUpdatePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        sendAck(
          ack,
          protocolError(
            "INVALID_PAYLOAD",
            parsed.error.issues[0]?.message ?? "잘못된 실시간 요청입니다",
          ),
        );
        return;
      }

      const result = manager.updateScene(socket.id, parsed.data);
      if (
        result.status !== "updated" &&
        result.status !== "duplicate" &&
        result.status !== "noop"
      ) {
        sendAck(ack, { ok: false, error: sceneResultError(result) });
        return;
      }
      const response: WhiteboardSceneAck = {
        ok: true,
        revision: result.revision,
        appliedElements: result.appliedElements,
        savedRevision: result.savedRevision,
        ...(result.fileUpdates ? { fileUpdates: result.fileUpdates } : {}),
      };
      sendAck(ack, response);
      if (result.status === "updated") {
        socket.to(roomName(result.documentId)).emit("whiteboard:scene:updated", {
          documentId: result.documentId,
          sourceUserId: result.sourceUserId,
          clientUpdateId: result.clientUpdateId,
          revision: result.revision,
          elements: result.appliedElements,
          ...(result.fileUpdates ? { fileUpdates: result.fileUpdates } : {}),
        });
      }
    });

    socket.on("whiteboard:presence:update", (rawPayload) => {
      if (!socket.data.presenceBucket.consume()) {
        presenceError({ code: "RATE_LIMITED", message: "실시간 요청이 너무 많습니다" });
        return;
      }
      const parsed = whiteboardPresenceUpdatePayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        presenceError({ code: "INVALID_PAYLOAD", message: "잘못된 실시간 요청입니다" });
        return;
      }
      const result = manager.updatePresence(socket.id, parsed.data);
      if (result.status !== "updated") {
        presenceError(
          sceneResultError({
            status: result.status,
            documentId: result.documentId,
            clientUpdateId: "presence",
          }),
        );
        return;
      }
      socket.volatile.to(roomName(result.documentId)).emit("whiteboard:presence:updated", {
        documentId: result.documentId,
        participant: result.participant,
      });
    });

    socket.on("disconnect", () => {
      disconnected = true;
      clearTimeout(socket.data.authExpiryTimer);
      const currentDocumentId = socket.data.currentDocumentId;
      if (currentDocumentId) {
        leaveSocketRoom(manager, socket, currentDocumentId);
        socket.data.currentDocumentId = undefined;
      }
    });
  });

  const close = (): Promise<void> => {
    if (closePromise) {
      return closePromise;
    }
    lifecycle.startDraining();
    const drainPromise = manager.close({ deadlineAt: dependencies.shutdownDeadlineAt() });
    const ioClosePromise = new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    closePromise = Promise.allSettled([drainPromise, ioClosePromise]).then(([drainResult]) => {
      if (drainResult.status === "rejected") {
        throw drainResult.reason;
      }
    });
    return closePromise;
  };

  return {
    documentDeleted,
    stats: () => manager.stats(),
    close,
  };
}

function joinResultError(
  status:
    | "room_capacity_exceeded"
    | "room_socket_capacity_exceeded"
    | "server_draining"
    | "content_integrity_error",
): WhiteboardProtocolError {
  if (status === "room_capacity_exceeded") {
    return { code: "ROOM_CAPACITY_EXCEEDED", message: "화이트보드 참여 인원이 가득 찼습니다" };
  }
  if (status === "room_socket_capacity_exceeded") {
    return { code: "ROOM_SOCKET_CAPACITY_EXCEEDED", message: "화이트보드 연결 수가 가득 찼습니다" };
  }
  if (status === "content_integrity_error") {
    return { code: "CONTENT_INTEGRITY_ERROR", message: ERROR_MESSAGES.CONTENT_INTEGRITY_ERROR };
  }
  return { code: "SERVER_DRAINING", message: "서버가 종료 중입니다" };
}

function sceneResultError(result: SceneUpdateResult): WhiteboardProtocolError {
  switch (result.status) {
    case "not_joined":
      return { code: "NOT_JOINED", message: "화이트보드 문서에 참여하지 않았습니다" };
    case "document_room_mismatch":
      return { code: "DOCUMENT_ROOM_MISMATCH", message: "현재 참여 중인 문서와 다릅니다" };
    case "file_version_conflict":
      return { code: "FILE_VERSION_CONFLICT", message: "같은 버전의 파일 내용이 충돌했습니다" };
    case "room_size_limit_exceeded":
      return { code: "ROOM_SIZE_LIMIT_EXCEEDED", message: "화이트보드 크기 제한을 초과했습니다" };
    case "persistence_unavailable":
      return {
        code: "PERSISTENCE_UNAVAILABLE",
        message: "화이트보드 변경사항을 저장할 수 없습니다",
      };
    case "server_draining":
      return { code: "SERVER_DRAINING", message: "서버가 종료 중입니다" };
    case "updated":
    case "duplicate":
    case "noop":
      return { code: "INTERNAL_SERVER_ERROR", message: ERROR_MESSAGES.INTERNAL_SERVER_ERROR };
  }
}

function leaveSocketRoom(
  manager: WhiteboardRoomManager,
  socket: WhiteboardSocket,
  documentId: string,
): void {
  const left = manager.leave(socket.id);
  if (!left || !left.participantLeft) {
    return;
  }
  socket.to(roomName(documentId)).emit("whiteboard:presence:left", {
    documentId,
    userId: left.userId,
  });
}
