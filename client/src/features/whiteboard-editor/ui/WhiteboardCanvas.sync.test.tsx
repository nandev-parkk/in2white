import { useEffect } from 'react'
import { render } from '@testing-library/react'
import { convertToExcalidrawElements } from '@excalidraw/excalidraw'
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import { afterEach, expect, it, vi } from 'vitest'
import { useWhiteboardEditor } from '../model/use-whiteboard-editor'
import WhiteboardCanvas from './WhiteboardCanvas'

const canvas = vi.hoisted(() => ({
  updateScene: vi.fn(),
  addFiles: vi.fn(),
  getSceneElementsIncludingDeleted: vi.fn(),
  getAppState: vi.fn(),
  getFiles: () => ({}),
}))

vi.mock('@excalidraw/excalidraw', async (importOriginal) => {
  // 모듈 초기화의 canvas 기능 탐지만 대체하고 복원·병합 함수는 실제로 실행한다.
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue({} as CanvasRenderingContext2D)
  const actual = await importOriginal<typeof import('@excalidraw/excalidraw')>()
  getContext.mockRestore()
  return {
    ...actual,
    Excalidraw: ({
      excalidrawAPI,
    }: {
      excalidrawAPI: (api: unknown) => void
    }) => {
      useEffect(() => excalidrawAPI(canvas), [excalidrawAPI])
      return <div aria-label="캔버스" />
    },
  }
})
vi.mock('@tanstack/react-router', () => ({ useBlocker: vi.fn() }))
vi.mock('../model/use-whiteboard-editor', () => ({
  useWhiteboardEditor: vi.fn(),
}))
afterEach(() => vi.resetAllMocks())

it.each(['newElement', 'resizingElement', 'editingTextElement'] as const)(
  '%s 편집 중 객체를 보존하고 편집 종료 후 서버 장면을 복원한다',
  (editingKey) => {
    const [drawing, remote] = convertToExcalidrawElements([
      { type: 'rectangle', id: 'drawing', x: 0, y: 0, width: 100, height: 100 },
      {
        type: 'rectangle',
        id: 'remote',
        x: 200,
        y: 0,
        width: 100,
        height: 100,
      },
    ])
    const active = {
      ...drawing,
      width: editingKey === 'newElement' ? 0 : 100,
      height: editingKey === 'newElement' ? 0 : 100,
    }
    let elements: readonly ExcalidrawElement[] = [active]
    canvas.getSceneElementsIncludingDeleted.mockImplementation(() => elements)
    canvas.getAppState.mockReturnValue({
      newElement: null,
      resizingElement: null,
      editingTextElement: null,
      [editingKey]: active,
    })
    canvas.updateScene.mockImplementation((update) => {
      if (update.elements) elements = update.elements
    })
    const view = {
      scene: { elements: [{ ...active }] },
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
        canvasContent: view.scene,
        revision: 0,
        lastSavedAt: '',
        createdAt: '',
        updatedAt: '',
      },
    }
    const { rerender } = render(<WhiteboardCanvas {...props} />)
    vi.mocked(useWhiteboardEditor).mockReturnValue({
      ...view,
      scene: { elements: [{ ...active }, remote] },
    })
    rerender(<WhiteboardCanvas {...props} />)

    // Excalidraw는 드래그 중 이 객체를 계속 변경하므로 참조도 유지해야 한다.
    expect(elements.find((element) => element.id === active.id)).toBe(active)
    expect(elements.find((element) => element.id === remote.id)).toMatchObject({
      width: 100,
      height: 100,
    })
    Object.assign(active, { width: 150, height: 150 })
    expect(elements.find((element) => element.id === active.id)).toMatchObject({
      width: 150,
      height: 150,
    })

    canvas.getAppState.mockReturnValue({
      newElement: null,
      resizingElement: null,
      editingTextElement: null,
    })
    vi.mocked(useWhiteboardEditor).mockReturnValue({
      ...view,
      scene: { elements: [{ ...remote, width: 50, version: 1 }] },
    })
    rerender(<WhiteboardCanvas {...props} />)
    expect(elements).toHaveLength(1)
    expect(elements[0]).toMatchObject({ id: remote.id, width: 50, version: 1 })
  },
)
