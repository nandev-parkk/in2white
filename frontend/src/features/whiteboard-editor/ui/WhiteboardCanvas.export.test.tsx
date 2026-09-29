import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { useWhiteboardEditor } from '../model/use-whiteboard-editor'
import { downloadScenePdf } from '../model/export-scene'
import WhiteboardCanvas from './WhiteboardCanvas'

const canvas = vi.hoisted(() => ({
  updateScene: vi.fn(),
  addFiles: vi.fn(),
  getSceneElementsIncludingDeleted: vi.fn(),
  getAppState: () => ({}),
  getFiles: () => ({}),
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
  }: {
    excalidrawAPI: (value: unknown) => void
  }) => {
    useEffect(() => excalidrawAPI(canvas), [excalidrawAPI])
    return <div aria-label="캔버스" />
  },
}))
vi.mock('@tanstack/react-router', () => ({ useBlocker: vi.fn() }))
vi.mock('../model/use-whiteboard-editor', () => ({
  useWhiteboardEditor: vi.fn(),
}))
vi.mock('../model/export-scene', () => ({
  downloadSceneFile: vi.fn(),
  downloadScenePdf: vi.fn(),
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

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

/**
 * jsdom은 포커스된 노드가 사라지면 그 다음 포커스 이동의 blur를 window로 쏘고,
 * Radix 메뉴는 window blur를 창 이탈로 보고 스스로 닫는다. 정리 후에도 남는
 * 요소에 포커스를 붙잡아 두어야 두 번째 테스트부터 메뉴가 열린다.
 */
const focusAnchor = window.document.createElement('button')
beforeEach(() => {
  vi.clearAllMocks()
  window.document.body.append(focusAnchor)
  focusAnchor.focus()
  // restoreAllMocks가 구현까지 되돌리므로 매 테스트에서 다시 세운다.
  canvas.getSceneElementsIncludingDeleted.mockReturnValue([])
  vi.mocked(useWhiteboardEditor).mockReturnValue({
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
  })
})
afterEach(() => vi.restoreAllMocks())

/** Radix 메뉴는 pointer 이벤트로 열리므로 fireEvent 대신 userEvent를 쓴다. */
async function openMenu() {
  await userEvent.click(screen.getByRole('button', { name: '더 보기' }))
  return screen.findByRole('menuitem', { name: 'PDF로 내려받기' })
}

it('메뉴에서 PDF로 내려받기를 고르면 현재 장면을 PDF로 만든다', async () => {
  vi.mocked(downloadScenePdf).mockResolvedValue('downloaded')
  render(<WhiteboardCanvas {...props} />)
  await userEvent.click(await openMenu())
  await waitFor(() =>
    expect(downloadScenePdf).toHaveBeenCalledWith(
      expect.objectContaining({ elements: [] }),
      '문서',
    ),
  )
  expect(toast.error).not.toHaveBeenCalled()
})

it('내보낼 내용이 없으면 안내 토스트를 띄운다', async () => {
  vi.mocked(downloadScenePdf).mockResolvedValue('empty')
  render(<WhiteboardCanvas {...props} />)
  await userEvent.click(await openMenu())
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('내보낼 내용이 없어요'),
  )
})

it('PDF 생성이 실패하면 실패 토스트를 띄운다', async () => {
  vi.mocked(downloadScenePdf).mockRejectedValue(new Error('render failed'))
  render(<WhiteboardCanvas {...props} />)
  await userEvent.click(await openMenu())
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith('PDF를 만들지 못했어요'),
  )
})

it('생성이 끝나기 전에는 PDF 항목을 다시 실행하지 않는다', async () => {
  let finish: (result: 'downloaded') => void = () => {}
  vi.mocked(downloadScenePdf).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  render(<WhiteboardCanvas {...props} />)
  await userEvent.click(await openMenu())
  await waitFor(() => expect(downloadScenePdf).toHaveBeenCalledTimes(1))

  const item = await openMenu()
  expect(item).toHaveAttribute('data-disabled')
  await userEvent.click(item)
  expect(downloadScenePdf).toHaveBeenCalledTimes(1)

  finish('downloaded')
  await waitFor(() =>
    expect(
      screen.getByRole('menuitem', { name: 'PDF로 내려받기' }),
    ).not.toHaveAttribute('data-disabled'),
  )
})

it('동기화가 끊기고 읽기 전용이어도 PDF를 내보낼 수 있다', async () => {
  vi.mocked(useWhiteboardEditor).mockReturnValue({
    scene: { elements: [] },
    participants: [],
    status: 'disconnected' as const,
    readOnly: true,
    error: '연결이 끊겼어요',
    hasUnsavedChanges: true,
    onSceneChange: vi.fn(),
    onPresenceChange: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  })
  vi.mocked(downloadScenePdf).mockResolvedValue('downloaded')
  render(<WhiteboardCanvas {...props} />)
  await userEvent.click(await openMenu())
  await waitFor(() => expect(downloadScenePdf).toHaveBeenCalledTimes(1))
})
