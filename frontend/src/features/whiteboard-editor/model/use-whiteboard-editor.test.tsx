import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { refreshAccessToken } from '@/features/auth/model/auth-session'
import { useWhiteboardEditor } from './use-whiteboard-editor'
import type { JoinAck, SceneAck } from './protocol'

const transport = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  return {
    handlers,
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    removeAllListeners: vi.fn(),
    auth: {},
  }
})
vi.mock('socket.io-client', () => ({
  io: () => ({
    ...transport,
    on: (name: string, handler: (...args: unknown[]) => void) => {
      transport.handlers.set(name, handler)
    },
    volatile: { emit: vi.fn() },
  }),
}))
vi.mock('@/features/auth/model/auth-session', () => ({
  refreshAccessToken: vi.fn().mockResolvedValue('renewed'),
}))
const props = {
  workspaceId: 'workspace',
  projectId: 'project',
  documentId: 'document',
  accessToken: 'token',
  userId: 'user',
}
const shape = (version = 1) => ({
  id: 'a',
  version,
  versionNonce: 1,
  isDeleted: false,
})
let joinAck: (ack: JoinAck) => void
let sceneAck: (ack: SceneAck) => void
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(refreshAccessToken).mockResolvedValue('renewed')
  transport.handlers.clear()
  transport.emit.mockImplementation(
    (
      name: string,
      _payload: unknown,
      ack: (result: JoinAck | SceneAck) => void,
    ) => {
      if (name === 'whiteboard:join') joinAck = ack
      if (name === 'whiteboard:scene:update') sceneAck = ack
    },
  )
})
afterEach(() => vi.useRealTimers())
it('세션 토큰이 사라지면 소켓을 닫고 미저장 장면을 읽기 전용으로 보존한다', () => {
  const { result, rerender } = renderHook(
    (value) => useWhiteboardEditor(value),
    { initialProps: props },
  )
  act(() => join())
  act(() => result.current.onSceneChange({ elements: [shape()] }))
  rerender({ ...props, accessToken: '' })
  expect(result.current.readOnly).toBe(true)
  expect(result.current.error).toContain('로그인')
  expect(result.current.scene.elements).toEqual([shape()])
  expect(transport.disconnect).toHaveBeenCalled()
})
it('누락된 도형은 삭제로 합성하지 않고 명시적인 tombstone만 전송한다', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useWhiteboardEditor(props))
  act(() => join())
  act(() => result.current.onSceneChange({ elements: [shape()] }))
  act(() => vi.advanceTimersByTime(100))
  act(() =>
    sceneAck({
      ok: true,
      revision: 1,
      savedRevision: 1,
      appliedElements: [shape()],
    }),
  )
  act(() => result.current.onSceneChange({ elements: [] }))
  act(() => vi.advanceTimersByTime(100))
  let updates = transport.emit.mock.calls.filter(
    ([name]) => name === 'whiteboard:scene:update',
  )
  expect(updates).toHaveLength(1)
  expect(result.current.scene.elements).toEqual([shape()])

  const deleted = { ...shape(2), isDeleted: true }
  act(() => result.current.onSceneChange({ elements: [deleted] }))
  act(() => vi.advanceTimersByTime(100))
  updates = transport.emit.mock.calls.filter(
    ([name]) => name === 'whiteboard:scene:update',
  )
  expect(updates).toHaveLength(2)
  expect(updates.at(-1)![1]).toMatchObject({ elements: [deleted] })
})
function join(revision = 0, savedRevision = 0) {
  transport.handlers.get('connect')?.()
  joinAck({
    ok: true,
    whiteboardDocument: {
      id: 'document',
      projectId: 'project',
      name: '문서',
      canvasContent: { elements: [] },
      revision,
      lastSavedAt: '',
    },
    participants: [],
    savedRevision,
    persistenceState: revision > savedRevision ? 'dirty' : 'clean',
  })
}
it('dirty 방 입장과 ack만으로 저장 완료를 표시하지 않는다', async () => {
  const { result } = renderHook(() => useWhiteboardEditor(props))
  act(() => join(1, 0))
  expect(result.current.status).toBe('saving')
  act(() =>
    transport.handlers.get('whiteboard:scene:saved')?.({
      documentId: 'document',
      revision: 1,
    }),
  )
  expect(result.current.status).toBe('saved')
  act(() => result.current.onSceneChange({ elements: [shape()] }))
  await waitFor(() =>
    expect(transport.emit).toHaveBeenCalledWith(
      'whiteboard:scene:update',
      expect.anything(),
      expect.any(Function),
    ),
  )
  act(() =>
    sceneAck({
      ok: true,
      revision: 2,
      savedRevision: 1,
      appliedElements: [shape()],
    }),
  )
  expect(result.current.status).toBe('saving')
  act(() =>
    transport.handlers.get('whiteboard:scene:saved')?.({
      documentId: 'document',
      revision: 2,
    }),
  )
  expect(result.current.status).toBe('saved')
})
it('재접속 스냅샷이 미확인 로컬 편집을 버리지 않는다', () => {
  const { result } = renderHook(() => useWhiteboardEditor(props))
  act(() => join())
  act(() => result.current.onSceneChange({ elements: [shape(3)] }))
  act(() => transport.handlers.get('disconnect')?.())
  expect(result.current.readOnly).toBe(true)
  act(() => join())
  expect(result.current.scene.elements).toEqual([shape(3)])
  expect(result.current.hasUnsavedChanges).toBe(true)
})
it('일시적인 입장 실패는 다시 연결하면 편집할 수 있다', () => {
  const { result } = renderHook(() => useWhiteboardEditor(props))
  act(() => {
    transport.handlers.get('connect')?.()
    joinAck({
      ok: false,
      error: { code: 'ROOM_CAPACITY_EXCEEDED', message: '참여 인원 초과' },
    })
  })
  expect(result.current.readOnly).toBe(true)
  act(() => result.current.retry())
  act(() => join())
  expect(result.current.status).toBe('saved')
  expect(result.current.readOnly).toBe(false)
})
it('갱신한 토큰도 거절되면 반복 갱신하지 않고 로그인을 안내한다', async () => {
  const { result } = renderHook(() => useWhiteboardEditor(props))
  await act(async () =>
    transport.handlers.get('connect_error')?.(new Error('UNAUTHORIZED')),
  )
  await act(async () =>
    transport.handlers.get('connect_error')?.(new Error('UNAUTHORIZED')),
  )
  expect(refreshAccessToken).toHaveBeenCalledTimes(1)
  expect(result.current.error).toContain('로그인')
  expect(result.current.readOnly).toBe(true)
})
it('정상 재동기화는 저장 장애를 해제하고 로컬 변경을 보존한다', () => {
  const { result } = renderHook(() => useWhiteboardEditor(props))
  act(() => join())
  act(() => result.current.onSceneChange({ elements: [shape(3)] }))
  act(() =>
    transport.handlers.get('whiteboard:scene:save-failed')?.({
      documentId: 'document',
      code: 'PERSISTENCE_UNAVAILABLE',
      message: '저장 실패',
    }),
  )
  act(() =>
    transport.handlers.get('whiteboard:sync:required')?.({
      documentId: 'document',
      snapshot: {
        canvasContent: { elements: [] },
        revision: 0,
        lastSavedAt: '',
      },
      savedRevision: 0,
      persistenceState: 'clean',
    }),
  )
  expect(result.current.error).toBeNull()
  expect(result.current.readOnly).toBe(false)
  expect(result.current.scene.elements).toEqual([shape(3)])
})
it('저장 실패와 문서 삭제는 편집을 잠그고 이전 callback은 해제 후 무시한다', () => {
  const { result, unmount } = renderHook(() => useWhiteboardEditor(props))
  act(() => join())
  act(() =>
    transport.handlers.get('whiteboard:scene:save-failed')?.({
      documentId: 'document',
      code: 'PERSISTENCE_UNAVAILABLE',
      message: '저장 실패',
    }),
  )
  expect(result.current.readOnly).toBe(true)
  act(() =>
    transport.handlers.get('whiteboard:document:deleted')?.({
      documentId: 'document',
    }),
  )
  expect(result.current.error).toContain('삭제')
  unmount()
  expect(transport.disconnect).toHaveBeenCalled()
})
it('ack 시간 초과는 같은 update ID로 세 번만 전송하고 편집을 보존한다', () => {
  vi.useFakeTimers()
  const { result } = renderHook(() => useWhiteboardEditor(props))
  act(() => join())
  act(() => result.current.onSceneChange({ elements: [shape()] }))
  act(() => vi.advanceTimersByTime(15100))
  const updates = transport.emit.mock.calls.filter(
    ([name]) => name === 'whiteboard:scene:update',
  )
  expect(updates).toHaveLength(3)
  expect(
    new Set(updates.map(([, payload]) => payload.clientUpdateId)).size,
  ).toBe(1)
  expect(result.current.status).toBe('error')
  expect(result.current.hasUnsavedChanges).toBe(true)
  expect(result.current.scene.elements).toEqual([shape()])
})
it('문서 전환과 unmount 뒤 도착한 이전 ack는 새 문서를 바꾸지 않는다', () => {
  vi.useFakeTimers()
  const { result, rerender, unmount } = renderHook(
    (value) => useWhiteboardEditor(value),
    { initialProps: props },
  )
  act(() => join())
  act(() => result.current.onSceneChange({ elements: [shape()] }))
  act(() => vi.advanceTimersByTime(100))
  const oldAck = sceneAck
  rerender({ ...props, documentId: 'other-document' })
  act(() => join())
  const late = () =>
    oldAck({
      ok: true,
      revision: 5,
      savedRevision: 0,
      appliedElements: [shape(5)],
    })
  act(late)
  expect(result.current.scene.elements).toEqual([])
  expect(result.current.status).toBe('saved')
  unmount()
  act(late)
  expect(vi.getTimerCount()).toBe(0)
})
it('blocked 방의 신규 입장은 잠기고 recovered 이후 편집 가능하다', () => {
  const { result } = renderHook(() => useWhiteboardEditor(props))
  act(() => {
    transport.handlers.get('connect')?.()
    joinAck({
      ok: true,
      whiteboardDocument: {
        id: 'document',
        projectId: 'project',
        name: '문서',
        canvasContent: { elements: [] },
        revision: 2,
        lastSavedAt: '',
      },
      participants: [],
      savedRevision: 1,
      persistenceState: 'blocked',
    })
  })
  expect(result.current.readOnly).toBe(true)
  expect(result.current.status).toBe('error')
  act(() =>
    transport.handlers.get('whiteboard:room:recovered')?.({
      documentId: 'document',
      revision: 2,
    }),
  )
  expect(result.current.readOnly).toBe(false)
  expect(result.current.status).toBe('saving')
})
it('토큰 갱신 실패는 미전송 편집을 보존한 채 잠근다', async () => {
  vi.mocked(refreshAccessToken).mockRejectedValueOnce(new Error('expired'))
  const { result } = renderHook(() => useWhiteboardEditor(props))
  act(() => join())
  act(() => result.current.onSceneChange({ elements: [shape()] }))
  await act(async () =>
    transport.handlers.get('whiteboard:auth:expired')?.({
      code: 'AUTH_EXPIRED',
    }),
  )
  expect(result.current.error).toContain('로그인')
  expect(result.current.readOnly).toBe(true)
  expect(result.current.scene.elements).toEqual([shape()])
})
