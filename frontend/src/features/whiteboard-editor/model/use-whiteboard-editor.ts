import { useEffect, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { io, type Socket } from 'socket.io-client'
import { refreshAccessToken } from '@/features/auth/model/auth-session'
import { env } from '@/shared/config/env'
import {
  diffScene,
  hasDelta,
  isSaved,
  mergeScene,
  nextBatch,
} from './scene-sync'
import type {
  CanvasContent,
  ClientEvents,
  Participant,
  SceneUpdate,
  ServerEvents,
} from './protocol'
import { MESSAGES } from '@/shared/constants/messages'

type Props = {
  workspaceId: string
  projectId: string
  documentId: string
  accessToken: string
  userId: string
}
export type EditorStatus =
  'connecting' | 'saved' | 'saving' | 'disconnected' | 'error'
type View = {
  scene: CanvasContent
  participants: Participant[]
  status: EditorStatus
  readOnly: boolean
  error: string | null
  hasUnsavedChanges: boolean
}
const empty = (): CanvasContent => ({ elements: [] })
const initial: View = {
  scene: empty(),
  participants: [],
  status: 'connecting',
  readOnly: true,
  error: null,
  hasUnsavedChanges: false,
}

export function useWhiteboardEditor({
  workspaceId,
  projectId,
  documentId,
  accessToken,
  userId,
}: Props) {
  const [view, setView] = useState<View>(initial)
  const token = useRef(accessToken)
  const actions = useRef<{
    change: (scene: CanvasContent) => void
    presence: (cursor: Participant['cursor'], ids: string[]) => void
    retry: () => void
    discard: () => void
    expire: () => void
  }>({
    change: () => {},
    presence: () => {},
    retry: () => {},
    discard: () => {},
    expire: () => {},
  })
  useEffect(() => {
    token.current = accessToken
    if (!accessToken) actions.current.expire()
  }, [accessToken])

  useEffect(() => {
    let disposed = false
    let terminal = false
    let joined = false
    let blocked = false
    let refreshing = false
    let refreshed = false
    let connection: 'connecting' | 'disconnected' | 'connected' = 'connecting'
    let error: string | null = null
    let confirmed = empty()
    let desired = empty()
    let participants: Participant[] = []
    let revision = 0
    let savedRevision = 0
    let epoch = 0
    let flight: SceneUpdate | null = null
    let sendTimer: ReturnType<typeof setTimeout> | undefined
    let ackTimer: ReturnType<typeof setTimeout> | undefined
    let joinTimer: ReturnType<typeof setTimeout> | undefined
    let presenceAt = 0
    const socket: Socket<ServerEvents, ClientEvents> = io(env.apiBaseUrl, {
      auth: { accessToken: token.current },
      autoConnect: false,
      reconnectionAttempts: 5,
    })
    const pending = () => hasDelta(diffScene(confirmed, desired))
    function publish() {
      if (disposed) return
      const unsaved = pending() || flight !== null || savedRevision < revision
      const status: EditorStatus =
        error || blocked
          ? 'error'
          : connection !== 'connected'
            ? connection
            : !joined
              ? 'connecting'
              : isSaved(revision, savedRevision, pending() || flight !== null)
                ? 'saved'
                : 'saving'
      setView({
        scene: desired,
        participants: [...participants],
        status,
        readOnly: !joined || blocked || !!error,
        error,
        hasUnsavedChanges: unsaved,
      })
    }
    function cancelFlight() {
      epoch++
      clearTimeout(ackTimer)
      clearTimeout(sendTimer)
      clearTimeout(joinTimer)
      flight = null
    }
    function fail(message: string, stop = false) {
      error = message
      if (stop) {
        terminal = true
        joined = false
        cancelFlight()
        socket.disconnect()
      }
      publish()
    }
    function schedule() {
      clearTimeout(sendTimer)
      if (!disposed && joined && !blocked && !error && !flight && pending())
        sendTimer = setTimeout(send, 100)
    }
    function send() {
      if (disposed || !joined || blocked || error || flight || !pending())
        return
      try {
        flight = {
          ...nextBatch(diffScene(confirmed, desired)),
          documentId,
          clientUpdateId: uuidv4(),
        }
      } catch (cause) {
        fail(
          cause instanceof Error
            ? cause.message
            : MESSAGES.whiteboard.sync.sendFailed,
        )
        return
      }
      const payload = flight
      const generation = epoch
      let attempts = 0
      function attempt() {
        if (disposed || generation !== epoch || flight !== payload) return
        attempts++
        ackTimer = setTimeout(() => {
          if (attempts < 3) attempt()
          else {
            cancelFlight()
            fail(MESSAGES.whiteboard.sync.ackFailed)
          }
        }, 5000)
        socket.emit('whiteboard:scene:update', payload, (ack) => {
          if (disposed || generation !== epoch || flight !== payload) return
          clearTimeout(ackTimer)
          flight = null
          if (!ack.ok) {
            if (ack.error.code === 'RATE_LIMITED') {
              sendTimer = setTimeout(send, 500)
              publish()
              return
            }
            blocked = ack.error.code === 'PERSISTENCE_UNAVAILABLE'
            fail(ack.error.message)
            return
          }
          const delta = {
            elements: ack.appliedElements,
            fileUpdates: ack.fileUpdates,
          }
          confirmed = mergeScene(confirmed, delta)
          desired = mergeScene(desired, delta)
          revision = Math.max(revision, ack.revision)
          savedRevision = Math.max(savedRevision, ack.savedRevision)
          publish()
          schedule()
        })
      }
      attempt()
      publish()
    }
    function join() {
      if (disposed || terminal) return
      cancelFlight()
      joined = false
      connection = 'connected'
      const generation = epoch
      joinTimer = setTimeout(
        () => fail(MESSAGES.whiteboard.sync.connectFailed),
        10000,
      )
      socket.emit(
        'whiteboard:join',
        { workspaceId, projectId, documentId },
        (ack) => {
          if (disposed || generation !== epoch || terminal) return
          clearTimeout(joinTimer)
          if (!ack.ok) {
            if (
              ack.error.code === 'UNAUTHORIZED' ||
              ack.error.code === 'AUTH_EXPIRED'
            ) {
              void refresh()
              return
            }
            fail(
              ack.error.message,
              [
                'WHITEBOARD_DOCUMENT_NOT_FOUND',
                'WORKSPACE_NOT_FOUND',
                'PROJECT_NOT_FOUND',
                'CONTENT_INTEGRITY_ERROR',
                'INVALID_PAYLOAD',
              ].includes(ack.error.code),
            )
            return
          }
          refreshed = false
          const local = diffScene(confirmed, desired)
          confirmed = ack.whiteboardDocument.canvasContent
          desired = mergeScene(confirmed, local)
          revision = ack.whiteboardDocument.revision
          savedRevision = ack.savedRevision
          participants = ack.participants
          blocked = ack.persistenceState === 'blocked'
          error = blocked ? MESSAGES.whiteboard.sync.serverUnavailable : null
          joined = true
          publish()
          schedule()
        },
      )
      publish()
    }
    async function refresh() {
      if (disposed || terminal || refreshing) return
      if (refreshed) {
        fail(MESSAGES.whiteboard.sync.sessionExpired, true)
        return
      }
      refreshed = true
      refreshing = true
      joined = false
      cancelFlight()
      socket.disconnect()
      publish()
      try {
        const nextToken = await refreshAccessToken()
        if (disposed || terminal) return
        token.current = nextToken
        socket.auth = { accessToken: nextToken }
        socket.connect()
      } catch {
        if (!disposed) fail(MESSAGES.whiteboard.sync.sessionExpired, true)
      } finally {
        refreshing = false
      }
    }
    socket.on('connect', join)
    socket.on('disconnect', () => {
      if (disposed || terminal) return
      joined = false
      connection = 'disconnected'
      cancelFlight()
      publish()
    })
    socket.on('connect_error', (cause) => {
      if (disposed || terminal) return
      if (
        cause.message === 'UNAUTHORIZED' ||
        (cause as Error & { data?: { code?: string } }).data?.code ===
          'UNAUTHORIZED'
      ) {
        void refresh()
        return
      }
      connection = 'disconnected'
      publish()
    })
    socket.on('whiteboard:auth:expired', () => {
      void refresh()
    })
    socket.on('whiteboard:scene:updated', (event) => {
      if (disposed || terminal || !joined || event.documentId !== documentId)
        return
      confirmed = mergeScene(confirmed, event)
      desired = mergeScene(desired, event)
      revision = Math.max(revision, event.revision)
      publish()
    })
    socket.on('whiteboard:scene:saved', (event) => {
      if (disposed || terminal || event.documentId !== documentId) return
      savedRevision = Math.max(savedRevision, event.revision)
      publish()
    })
    socket.on('whiteboard:scene:save-failed', (event) => {
      if (disposed || terminal || event.documentId !== documentId) return
      blocked = true
      fail(event.message, event.code === 'CONTENT_INTEGRITY_ERROR')
    })
    socket.on('whiteboard:room:recovered', (event) => {
      if (disposed || terminal || event.documentId !== documentId) return
      blocked = false
      error = null
      publish()
      schedule()
    })
    socket.on('whiteboard:sync:required', (event) => {
      if (disposed || terminal || event.documentId !== documentId) return
      const local = diffScene(confirmed, desired)
      cancelFlight()
      confirmed = event.snapshot.canvasContent
      desired = mergeScene(confirmed, local)
      revision = event.snapshot.revision
      savedRevision = event.savedRevision
      blocked = event.persistenceState === 'blocked'
      error = blocked ? MESSAGES.whiteboard.sync.serverUnavailable : null
      publish()
      schedule()
    })
    socket.on('whiteboard:document:deleted', (event) => {
      if (!disposed && event.documentId === documentId)
        fail(MESSAGES.whiteboard.sync.documentDeleted, true)
    })
    socket.on('whiteboard:error', (event) => {
      if (!disposed && !terminal && event.code !== 'RATE_LIMITED')
        fail(event.message)
    })
    const presence = (event: {
      documentId: string
      participant: Participant
    }) => {
      if (disposed || terminal || event.documentId !== documentId) return
      participants = [
        ...participants.filter(
          (person) => person.userId !== event.participant.userId,
        ),
        event.participant,
      ]
      publish()
    }
    socket.on('whiteboard:presence:joined', presence)
    socket.on('whiteboard:presence:updated', presence)
    socket.on('whiteboard:presence:left', (event) => {
      if (disposed || terminal || event.documentId !== documentId) return
      participants = participants.filter(
        (person) => person.userId !== event.userId,
      )
      publish()
    })
    actions.current = {
      expire: () => fail(MESSAGES.whiteboard.sync.sessionExpired, true),
      change: (scene) => {
        if (disposed || !joined || blocked || error) return
        const delta = diffScene(desired, scene)
        if (!hasDelta(delta)) return
        desired = mergeScene(desired, delta)
        publish()
        schedule()
      },
      presence: (cursor, activeElementIds) => {
        if (disposed || !joined || Date.now() - presenceAt < 50) return
        presenceAt = Date.now()
        socket.volatile.emit('whiteboard:presence:update', {
          documentId,
          cursor,
          activeElementIds: activeElementIds.slice(0, 50),
        })
      },
      retry: () => {
        if (disposed || terminal) return
        error = null
        cancelFlight()
        socket.disconnect()
        socket.auth = { accessToken: token.current }
        connection = 'connecting'
        publish()
        socket.connect()
      },
      discard: () => {
        if (disposed || flight) return
        desired = confirmed
        error = blocked ? error : null
        publish()
      },
    }
    if (token.current) socket.connect()
    else actions.current.expire()
    return () => {
      disposed = true
      cancelFlight()
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [workspaceId, projectId, documentId, userId])

  return {
    ...view,
    onSceneChange: (scene: CanvasContent) => actions.current.change(scene),
    onPresenceChange: (cursor: Participant['cursor'], ids: string[]) =>
      actions.current.presence(cursor, ids),
    retry: () => actions.current.retry(),
    discard: () => actions.current.discard(),
  }
}
