import type { AccessTokenPayload } from "@/lib/jwt";
import type {
  WhiteboardJoinPayload,
  WhiteboardPresenceUpdatePayload,
  WhiteboardSceneUpdatePayload,
} from "@/realtime/whiteboard-protocol.schema";
import type { TokenBucket } from "@/realtime/whiteboard-rate-limiter";
import type { WhiteboardParticipant, PersistenceState } from "@/realtime/whiteboard-room-manager";
import type { CanvasContent, WhiteboardElement, WhiteboardFileUpdates } from "@/types/whiteboard";

export type WhiteboardErrorCode =
  | "UNAUTHORIZED"
  | "AUTH_EXPIRED"
  | "INVALID_PAYLOAD"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "NOT_JOINED"
  | "DOCUMENT_ROOM_MISMATCH"
  | "ROOM_CAPACITY_EXCEEDED"
  | "ROOM_SOCKET_CAPACITY_EXCEEDED"
  | "ROOM_SIZE_LIMIT_EXCEEDED"
  | "FILE_VERSION_CONFLICT"
  | "PERSISTENCE_UNAVAILABLE"
  | "SERVER_DRAINING"
  | "CONTENT_INTEGRITY_ERROR"
  | "WHITEBOARD_DOCUMENT_NOT_FOUND"
  | "WORKSPACE_NOT_FOUND"
  | "PROJECT_NOT_FOUND"
  | "INTERNAL_SERVER_ERROR";

export interface WhiteboardProtocolError {
  code: WhiteboardErrorCode;
  message: string;
}

interface WhiteboardDocumentSocketResponse {
  id: string;
  projectId: string;
  name: string;
  canvasContent: CanvasContent;
  revision: number;
  lastSavedAt: string;
}

export type WhiteboardJoinAck =
  | {
      ok: true;
      whiteboardDocument: WhiteboardDocumentSocketResponse;
      participants: WhiteboardParticipant[];
      savedRevision: number;
      persistenceState: PersistenceState;
    }
  | { ok: false; error: WhiteboardProtocolError };

export type WhiteboardSceneAck =
  | {
      ok: true;
      revision: number;
      appliedElements: WhiteboardElement[];
      savedRevision: number;
      fileUpdates?: WhiteboardFileUpdates;
    }
  | { ok: false; error: WhiteboardProtocolError };

export interface WhiteboardSceneUpdatedEvent {
  documentId: string;
  sourceUserId: string;
  clientUpdateId: string;
  revision: number;
  elements: WhiteboardElement[];
  fileUpdates?: WhiteboardFileUpdates;
}

export interface WhiteboardSceneSavedEvent {
  documentId: string;
  revision: number;
  lastSavedAt: string;
}

export interface WhiteboardSaveFailedEvent {
  documentId: string;
  revision: number;
  code: "PERSISTENCE_UNAVAILABLE" | "CONTENT_INTEGRITY_ERROR";
  message: string;
}

export interface WhiteboardSyncRequiredEvent {
  documentId: string;
  savedRevision: number;
  persistenceState: PersistenceState;
  snapshot: { canvasContent: CanvasContent; revision: number; lastSavedAt: string };
}

export interface WhiteboardPresenceJoinedEvent {
  documentId: string;
  participant: WhiteboardParticipant;
}

export type WhiteboardPresenceUpdatedEvent = WhiteboardPresenceJoinedEvent;

export interface WhiteboardPresenceLeftEvent {
  documentId: string;
  userId: string;
}

export interface WhiteboardClientToServerEvents {
  "whiteboard:join": (
    payload: WhiteboardJoinPayload,
    ack?: (response: WhiteboardJoinAck) => void,
  ) => void;
  "whiteboard:scene:update": (
    payload: WhiteboardSceneUpdatePayload,
    ack?: (response: WhiteboardSceneAck) => void,
  ) => void;
  "whiteboard:presence:update": (payload: WhiteboardPresenceUpdatePayload) => void;
}

export interface WhiteboardServerToClientEvents {
  "whiteboard:scene:updated": (event: WhiteboardSceneUpdatedEvent) => void;
  "whiteboard:scene:saved": (event: WhiteboardSceneSavedEvent) => void;
  "whiteboard:scene:save-failed": (event: WhiteboardSaveFailedEvent) => void;
  "whiteboard:sync:required": (event: WhiteboardSyncRequiredEvent) => void;
  "whiteboard:room:recovered": (event: { documentId: string; revision: number }) => void;
  "whiteboard:document:deleted": (event: { documentId: string }) => void;
  "whiteboard:auth:expired": (event: { code: "AUTH_EXPIRED" }) => void;
  "whiteboard:error": (event: WhiteboardProtocolError) => void;
  "whiteboard:presence:joined": (event: WhiteboardPresenceJoinedEvent) => void;
  "whiteboard:presence:updated": (event: WhiteboardPresenceUpdatedEvent) => void;
  "whiteboard:presence:left": (event: WhiteboardPresenceLeftEvent) => void;
}

export type WhiteboardInterServerEvents = Record<never, never>;

export interface WhiteboardSocketData {
  user: AccessTokenPayload;
  authExpiryTimer: ReturnType<typeof setTimeout>;
  sceneBucket: TokenBucket;
  presenceBucket: TokenBucket;
  currentDocumentId?: string;
}
