import type {
  CanvasContent,
  WhiteboardElement,
  WhiteboardFile,
} from '@/entities/whiteboard-document/model/content'
export type {
  CanvasContent,
  WhiteboardElement,
  WhiteboardFile,
} from '@/entities/whiteboard-document/model/content'
export type SceneDelta = {
  elements: WhiteboardElement[]
  fileUpdates?: Record<string, WhiteboardFile>
}
export type Participant = {
  userId: string
  name: string
  presenceIndex: number
  cursor: { x: number; y: number } | null
  activeElementIds: string[]
}
export type PersistenceState =
  'clean' | 'dirty' | 'saving' | 'retrying' | 'blocked' | 'deleted' | 'failed'
export type Snapshot = {
  canvasContent: CanvasContent
  revision: number
  lastSavedAt: string
}
export type DocumentDetail = Snapshot & {
  id: string
  projectId: string
  name: string
}
export type Failure = { ok: false; error: { code: string; message: string } }
export type JoinAck =
  | Failure
  | {
      ok: true
      whiteboardDocument: DocumentDetail
      participants: Participant[]
      savedRevision: number
      persistenceState: PersistenceState
    }
export type SceneAck =
  | Failure
  | {
      ok: true
      revision: number
      appliedElements: WhiteboardElement[]
      savedRevision: number
      fileUpdates?: Record<string, WhiteboardFile>
    }
export type SceneUpdate = SceneDelta & {
  documentId: string
  clientUpdateId: string
}
export type ServerEvents = {
  'whiteboard:scene:updated': (
    event: SceneUpdate & { revision: number; sourceUserId: string },
  ) => void
  'whiteboard:scene:saved': (event: {
    documentId: string
    revision: number
    lastSavedAt: string
  }) => void
  'whiteboard:scene:save-failed': (event: {
    documentId: string
    code: string
    message: string
    revision: number
  }) => void
  'whiteboard:sync:required': (event: {
    documentId: string
    snapshot: Snapshot
    savedRevision: number
    persistenceState: PersistenceState
  }) => void
  'whiteboard:room:recovered': (event: {
    documentId: string
    revision: number
  }) => void
  'whiteboard:document:deleted': (event: { documentId: string }) => void
  'whiteboard:auth:expired': (event: { code: string }) => void
  'whiteboard:error': (event: { code: string; message: string }) => void
  'whiteboard:presence:joined': (event: {
    documentId: string
    participant: Participant
  }) => void
  'whiteboard:presence:updated': (event: {
    documentId: string
    participant: Participant
  }) => void
  'whiteboard:presence:left': (event: {
    documentId: string
    userId: string
  }) => void
}
export type ClientEvents = {
  'whiteboard:join': (
    payload: { workspaceId: string; projectId: string; documentId: string },
    ack: (result: JoinAck) => void,
  ) => void
  'whiteboard:scene:update': (
    payload: SceneUpdate,
    ack: (result: SceneAck) => void,
  ) => void
  'whiteboard:presence:update': (payload: {
    documentId: string
    cursor: Participant['cursor']
    activeElementIds: string[]
  }) => void
}
