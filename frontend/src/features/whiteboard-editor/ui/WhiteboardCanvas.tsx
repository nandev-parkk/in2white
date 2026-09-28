import { useEffect, useRef, useState } from 'react'
import { useBlocker } from '@tanstack/react-router'
import {
  CaptureUpdateAction,
  Excalidraw,
  MainMenu,
  reconcileElements,
  restoreElements,
} from '@excalidraw/excalidraw'
import type {
  BinaryFileData,
  ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile'
import '@excalidraw/excalidraw/index.css'
import type { WhiteboardDocumentDetail } from '@/entities/whiteboard-document'
import { CanvasTopBar } from '@/shared/ui/canvas-top-bar'
import { Button } from '@/shared/ui/button'
import { MoreVertical } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { useWhiteboardEditor } from '../model/use-whiteboard-editor'
import { diffScene, hasDelta, mergeScene } from '../model/scene-sync'
import type { CanvasContent, WhiteboardElement } from '../model/protocol'
import { MESSAGES } from '@/shared/constants/messages'

type Props = {
  workspaceId: string
  projectId: string
  document: WhiteboardDocumentDetail
  accessToken: string
  userId: string
  onBack: () => void
}

export default function WhiteboardCanvas({
  workspaceId,
  projectId,
  document,
  accessToken,
  userId,
  onBack,
}: Props) {
  const editor = useWhiteboardEditor({
    workspaceId,
    projectId,
    documentId: document.id,
    accessToken,
    userId,
  })
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null)
  const selected = useRef<string[]>([])
  const applying = useRef(false)
  const ready = useRef(false)
  const appliedScene = useRef<CanvasContent | null>(null)
  const [initialData] = useState(() => ({
    elements: restoreElements(
      mergeScene(document.canvasContent, { elements: [] })
        .elements as unknown as ExcalidrawElement[],
      null,
    ),
    files: document.canvasContent.files as Record<string, BinaryFileData>,
  }))
  useBlocker({
    shouldBlockFn: () =>
      editor.hasUnsavedChanges &&
      !window.confirm(MESSAGES.whiteboard.confirm.leaveWithUnsaved),
    enableBeforeUnload: editor.hasUnsavedChanges,
  })
  useEffect(() => {
    if (!api || editor.status === 'connecting') {
      ready.current = false
      return
    }
    const current: CanvasContent = {
      elements: api
        .getSceneElementsIncludingDeleted()
        .map((element) => ({ ...element })) as WhiteboardElement[],
      files: api.getFiles(),
    }
    const unchanged =
      !hasDelta(diffScene(current, editor.scene)) &&
      !hasDelta(diffScene(editor.scene, current)) &&
      current.elements.length === editor.scene.elements.length &&
      current.elements.every(
        (element, index) => element.id === editor.scene.elements[index]?.id,
      )
    if (!unchanged) {
      applying.current = true
      if (editor.scene.files)
        api.addFiles(Object.values(editor.scene.files) as BinaryFileData[])
      const appState = api.getAppState()
      // 편집 중인 객체만 보존해야 명시적인 서버 장면 되돌리기도 계속 동작한다.
      const editingElements = api
        .getSceneElementsIncludingDeleted()
        .filter(
          (element) =>
            element.id === appState.newElement?.id ||
            element.id === appState.resizingElement?.id ||
            element.id === appState.editingTextElement?.id,
        )
      api.updateScene({
        elements: reconcileElements(
          editingElements,
          restoreElements(
            editor.scene.elements as unknown as ExcalidrawElement[],
            null,
          ) as unknown as RemoteExcalidrawElement[],
          appState,
        ),
        captureUpdate: CaptureUpdateAction.NEVER,
      })
      applying.current = false
    }
    appliedScene.current = editor.scene
    ready.current = true
  }, [api, editor.scene, editor.status])
  useEffect(() => {
    if (!api) return
    const collaborators = new Map(
      editor.participants
        .filter((person) => person.userId !== userId)
        .map((person) => [
          person.userId,
          {
            id: person.userId,
            username: person.name,
            ...(person.cursor
              ? { pointer: { ...person.cursor, tool: 'pointer' as const } }
              : {}),
            selectedElementIds: Object.fromEntries(
              person.activeElementIds.map((id) => [id, true]),
            ),
          },
        ]),
    ) as Parameters<ExcalidrawImperativeAPI['updateScene']>[0]['collaborators']
    api.updateScene({ collaborators, captureUpdate: CaptureUpdateAction.NEVER })
  }, [api, editor.participants, userId])
  function exportScene() {
    const scene = api
      ? {
          elements: api.getSceneElementsIncludingDeleted(),
          files: api.getFiles(),
        }
      : editor.scene
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify({
            type: 'excalidraw',
            version: 2,
            source: 'in2white',
            ...scene,
          }),
        ],
        { type: 'application/json' },
      ),
    )
    const link = window.document.createElement('a')
    link.href = url
    link.download = document.name.replace(/[\\/:*?"<>|]/g, '_') + '.excalidraw'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col">
      <CanvasTopBar
        title={document.name}
        saveStatus={editor.status}
        onBack={onBack}
        users={editor.participants.map((person) => ({
          id: person.userId,
          name: person.name,
          presenceIndex: person.presenceIndex + 1,
        }))}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={MESSAGES.whiteboard.a11y.moreActions}
                className="text-foreground-default flex size-8 items-center justify-center rounded-sm focus-visible:outline-2"
              >
                <MoreVertical className="size-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onSelect={exportScene}>
                  {MESSAGES.whiteboard.action.exportFile}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {(editor.error || editor.status === 'disconnected') && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border-b p-3"
        >
          <p>{editor.error ?? MESSAGES.whiteboard.sync.disconnected}</p>
          <Button variant="secondary" onClick={editor.retry}>
            {MESSAGES.whiteboard.action.reconnect}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm(MESSAGES.whiteboard.confirm.discardPending)) {
                editor.discard()
              }
            }}
          >
            {MESSAGES.whiteboard.action.discardPending}
          </Button>
        </div>
      )}
      <div
        className="min-h-0 flex-1 [&_label:has(.default-sidebar-trigger)]:hidden!"
        aria-label={MESSAGES.whiteboard.a11y.editor}
      >
        <Excalidraw
          excalidrawAPI={setApi}
          initialData={initialData}
          langCode="ko-KR"
          isCollaborating
          viewModeEnabled={editor.readOnly}
          onChange={(elements, appState, files) => {
            selected.current = Object.keys(appState.selectedElementIds)
            const current = api?.getSceneElementsIncludingDeleted()
            const currentEvent =
              !current ||
              (current.length === elements.length &&
                current.every(
                  (element, index) =>
                    element.id === elements[index]?.id &&
                    element.version === elements[index]?.version &&
                    element.versionNonce === elements[index]?.versionNonce &&
                    element.isDeleted === elements[index]?.isDeleted,
                ))
            if (
              ready.current &&
              appliedScene.current === editor.scene &&
              !applying.current &&
              currentEvent
            )
              editor.onSceneChange({
                elements: elements.map((element) => ({
                  ...element,
                })) as WhiteboardElement[],
                files,
              })
          }}
          onPointerUpdate={({ pointer }) =>
            editor.onPresenceChange(
              { x: pointer.x, y: pointer.y },
              selected.current,
            )
          }
        >
          <MainMenu>
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.SaveToActiveFile />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.SearchMenu />
            <MainMenu.DefaultItems.Help />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
          </MainMenu>
        </Excalidraw>
      </div>
    </main>
  )
}
