import { useEffect, useLayoutEffect } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useWhiteboardEditor } from '../model/use-whiteboard-editor'
import WhiteboardCanvas from './WhiteboardCanvas'

const canvas = vi.hoisted(() => ({
  updateScene: vi.fn(),
  resetScene: vi.fn(),
  addFiles: vi.fn(),
  refresh: vi.fn(),
  getSceneElementsIncludingDeleted: vi.fn(),
  getAppState: () => ({}),
  getFiles: () => ({}),
  emitBeforeSync: false,
  beforeSyncElements: [] as unknown[],
  change: undefined as
    | undefined
    | ((
        elements: unknown[],
        state: { selectedElementIds: Record<string, boolean> },
        files: Record<string, unknown>,
      ) => void),
}))
vi.mock('@excalidraw/excalidraw', () => ({
  CaptureUpdateAction: { NEVER: 'never' },
  restoreElements: (elements: unknown) => elements,
  reconcileElements: (_local: unknown, remote: unknown) => remote,
  MainMenu: Object.assign(() => null, {
    DefaultItems: {
      LoadScene: () => null,
      SaveToActiveFile: () => null,
      Export: () => null,
      SaveAsImage: () => null,
      SearchMenu: () => null,
      Help: () => null,
      ClearCanvas: () => null,
      ToggleTheme: () => null,
      ChangeCanvasBackground: () => null,
    },
    Separator: () => null,
  }),
  Excalidraw: ({
    excalidrawAPI,
    onChange,
  }: {
    excalidrawAPI: (value: unknown) => void
    onChange: (
      elements: unknown[],
      state: { selectedElementIds: Record<string, boolean> },
      files: Record<string, unknown>,
    ) => void
  }) => {
    canvas.change = onChange
    useEffect(() => excalidrawAPI(canvas), [excalidrawAPI])
    useLayoutEffect(() => {
      if (canvas.emitBeforeSync)
        onChange(canvas.beforeSyncElements, { selectedElementIds: {} }, {})
    }, [onChange])
    return <div aria-label="캔버스" />
  },
}))
vi.mock('@tanstack/react-router', () => ({ useBlocker: vi.fn() }))
vi.mock('../model/use-whiteboard-editor', () => ({
  useWhiteboardEditor: vi.fn(),
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: undefined,
  })
})

it('재입장 직후의 빈 초기 이벤트를 저장된 요소의 전체 삭제로 보내지 않는다', () => {
  const shape = {
    id: 'saved-shape',
    version: 1,
    versionNonce: 1,
    isDeleted: false,
  }
  canvas.getSceneElementsIncludingDeleted.mockReturnValue([])
  const onSceneChange = vi.fn()
  const view = {
    scene: { elements: [] },
    participants: [],
    status: 'connecting' as const,
    readOnly: true,
    error: null,
    hasUnsavedChanges: false,
    onSceneChange,
    onPresenceChange: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  }
  vi.mocked(useWhiteboardEditor).mockReturnValue(view)
  const props = {
    workspaceId: 'workspace',
    projectId: 'project',
    userId: 'user',
    accessToken: 'token',
    onBack: vi.fn(),
    document: {
      id: 'document',
      projectId: 'project',
      creatorId: 'user',
      name: '문서',
      canvasContent: { elements: [] },
      revision: 0,
      lastSavedAt: '',
      createdAt: '',
      updatedAt: '',
    },
  }
  const { rerender } = render(<WhiteboardCanvas {...props} />)
  onSceneChange.mockClear()
  canvas.emitBeforeSync = true
  vi.mocked(useWhiteboardEditor).mockReturnValue({
    ...view,
    scene: { elements: [shape] },
    status: 'saved',
    readOnly: false,
  })
  rerender(<WhiteboardCanvas {...props} />)
  expect(onSceneChange).not.toHaveBeenCalled()
  expect(canvas.updateScene).toHaveBeenCalledWith(
    expect.objectContaining({ elements: [shape] }),
  )
  onSceneChange.mockClear()
  canvas.getSceneElementsIncludingDeleted.mockReturnValue([shape])
  canvas.change?.([], { selectedElementIds: {} }, {})
  expect(onSceneChange).not.toHaveBeenCalled()
  canvas.emitBeforeSync = false
})

it('준비 완료 후 새 원격 요소 적용 직전의 이전 장면을 로컬 삭제로 보내지 않는다', () => {
  const first = { id: 'first', version: 1, versionNonce: 1, isDeleted: false }
  const remote = { id: 'remote', version: 1, versionNonce: 1, isDeleted: false }
  const onSceneChange = vi.fn()
  canvas.emitBeforeSync = false
  canvas.getSceneElementsIncludingDeleted.mockReturnValue([first])
  const view = {
    scene: { elements: [first] },
    participants: [],
    status: 'saved' as const,
    readOnly: false,
    error: null,
    hasUnsavedChanges: false,
    onSceneChange,
    onPresenceChange: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  }
  vi.mocked(useWhiteboardEditor).mockReturnValue(view)
  const props = {
    workspaceId: 'workspace',
    projectId: 'project',
    userId: 'user',
    accessToken: 'token',
    onBack: vi.fn(),
    document: {
      id: 'document',
      projectId: 'project',
      creatorId: 'user',
      name: '문서',
      canvasContent: { elements: [first] },
      revision: 1,
      lastSavedAt: '',
      createdAt: '',
      updatedAt: '',
    },
  }
  const { rerender } = render(<WhiteboardCanvas {...props} />)
  onSceneChange.mockClear()
  canvas.emitBeforeSync = true
  canvas.beforeSyncElements = [first]
  vi.mocked(useWhiteboardEditor).mockReturnValue({
    ...view,
    scene: { elements: [first, remote] },
  })
  rerender(<WhiteboardCanvas {...props} />)
  expect(onSceneChange).not.toHaveBeenCalled()
  expect(canvas.updateScene).toHaveBeenCalledWith(
    expect.objectContaining({ elements: [first, remote] }),
  )
  canvas.emitBeforeSync = false
  canvas.beforeSyncElements = []
})

it('명시적 되돌리기는 낮은 서버 버전도 반영하며 캔버스 초기화로 삭제 이벤트를 만들지 않는다', () => {
  const shape = { id: 'shape', version: 2, versionNonce: 1, isDeleted: false }
  canvas.getSceneElementsIncludingDeleted.mockReturnValue([shape])
  const view = {
    scene: { elements: [shape] },
    participants: [],
    status: 'error' as const,
    readOnly: true,
    error: '저장 실패',
    hasUnsavedChanges: true,
    onSceneChange: vi.fn(),
    onPresenceChange: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  }
  vi.mocked(useWhiteboardEditor).mockReturnValue(view)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const props = {
    workspaceId: 'workspace',
    projectId: 'project',
    userId: 'user',
    accessToken: 'token',
    onBack: vi.fn(),
    document: {
      id: 'document',
      projectId: 'project',
      creatorId: 'user',
      name: '문서',
      canvasContent: { elements: [] },
      revision: 0,
      lastSavedAt: '',
      createdAt: '',
      updatedAt: '',
    },
  }
  const { rerender } = render(<WhiteboardCanvas {...props} />)
  fireEvent.click(screen.getByRole('button', { name: '미전송 변경 버리기' }))
  expect(canvas.resetScene).not.toHaveBeenCalled()
  const saved = { ...shape, version: 1 }
  vi.mocked(useWhiteboardEditor).mockReturnValue({
    ...view,
    scene: { elements: [saved] },
  })
  rerender(<WhiteboardCanvas {...props} />)
  expect(canvas.updateScene).toHaveBeenCalledWith(
    expect.objectContaining({ elements: [saved] }),
  )
})

it('visual viewport가 바뀌면 캔버스 높이와 Excalidraw 레이아웃을 갱신한다', async () => {
  const visualViewport = new EventTarget() as VisualViewport & {
    height: number
  }
  Object.defineProperties(visualViewport, {
    height: { configurable: true, writable: true, value: 600 },
    offsetTop: { configurable: true, writable: true, value: 0 },
  })
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: visualViewport,
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())

  const view = {
    scene: { elements: [] },
    participants: [],
    status: 'saved' as const,
    readOnly: false,
    error: null,
    hasUnsavedChanges: false,
    onSceneChange: vi.fn(),
    onPresenceChange: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  }
  vi.mocked(useWhiteboardEditor).mockReturnValue(view)
  const { container } = render(
    <WhiteboardCanvas
      workspaceId="workspace"
      projectId="project"
      userId="user"
      accessToken="token"
      onBack={vi.fn()}
      document={{
        id: 'document',
        projectId: 'project',
        creatorId: 'user',
        name: '문서',
        canvasContent: { elements: [] },
        revision: 0,
        lastSavedAt: '',
        createdAt: '',
        updatedAt: '',
      }}
    />,
  )

  const canvasRoot = container.querySelector('main')
  expect(canvasRoot).toHaveStyle({ height: '600px' })
  await waitFor(() => expect(canvas.refresh).toHaveBeenCalled())

  canvas.refresh.mockClear()
  visualViewport.height = 500
  visualViewport.dispatchEvent(new Event('resize'))

  await waitFor(() => expect(canvas.refresh).toHaveBeenCalledTimes(1))
  expect(canvasRoot).toHaveStyle({ height: '500px' })
})
