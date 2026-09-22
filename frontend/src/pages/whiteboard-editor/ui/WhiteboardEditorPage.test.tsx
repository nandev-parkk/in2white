import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/entities/session'
import { getWhiteboardDocumentRequest } from '@/entities/whiteboard-document'
import { WhiteboardEditorPage } from './WhiteboardEditorPage'

vi.mock('@/entities/whiteboard-document', () => ({
  getWhiteboardDocumentRequest: vi.fn(),
}))
vi.mock('@/features/whiteboard-editor/ui/WhiteboardCanvas', () => ({
  default: function Editor() {
    const [text, setText] = useState('')
    return (
      <textarea
        aria-label="미저장 편집"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    )
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  useSessionStore.getState().setSession('token', {
    id: 'user',
    name: '사용자',
    email: 'test@example.test',
  })
})
function show() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <WhiteboardEditorPage
        workspaceId="workspace"
        projectId="project"
        documentId="document"
        onBack={vi.fn()}
      />
    </QueryClientProvider>,
  )
  return client
}

it('편집기 최초 조회가 짧으면 숨기고 300ms 이후 중앙 로딩을 표시한다', async () => {
  vi.useFakeTimers()
  try {
    vi.mocked(getWhiteboardDocumentRequest).mockImplementation(
      () => new Promise(() => {}),
    )
    show()
    await act(async () => vi.advanceTimersByTimeAsync(299))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(screen.getByRole('status')).toHaveTextContent(
      '화이트보드를 불러오는 중',
    )
  } finally {
    vi.useRealTimers()
  }
})
it('백그라운드 상세 재조회 실패가 열린 편집기의 미저장 내용을 없애지 않는다', async () => {
  vi.mocked(getWhiteboardDocumentRequest).mockResolvedValue({
    id: 'document',
    creatorId: 'user',
    projectId: 'project',
    name: '문서',
    canvasContent: { elements: [] },
    revision: 0,
    lastSavedAt: '',
    createdAt: '',
    updatedAt: '',
  })
  const client = show()
  fireEvent.change(
    await screen.findByRole('textbox', { name: '미저장 편집' }),
    { target: { value: '아직 전송되지 않은 변경' } },
  )
  vi.mocked(getWhiteboardDocumentRequest).mockRejectedValue(
    new Error('offline'),
  )
  vi.useFakeTimers()
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['whiteboard-document'] })
    await vi.runAllTimersAsync()
  })
  vi.useRealTimers()
  expect(screen.getByRole('textbox', { name: '미저장 편집' })).toHaveValue(
    '아직 전송되지 않은 변경',
  )
})
it('접근할 수 없는 문서에서 편집기를 열지 않는다', async () => {
  vi.mocked(getWhiteboardDocumentRequest).mockRejectedValue({
    response: { status: 404 },
  })
  show()
  expect(
    await screen.findByText('화이트보드를 찾을 수 없어요'),
  ).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: '프로젝트로 돌아가기' }),
  ).toBeInTheDocument()
})
it('세션 초기화 후에도 이미 열린 편집기를 보존한다', async () => {
  vi.mocked(getWhiteboardDocumentRequest).mockResolvedValue({
    id: 'document',
    creatorId: 'user',
    projectId: 'project',
    name: '문서',
    canvasContent: { elements: [] },
    revision: 0,
    lastSavedAt: '',
    createdAt: '',
    updatedAt: '',
  })
  show()
  fireEvent.change(
    await screen.findByRole('textbox', { name: '미저장 편집' }),
    { target: { value: '내보낼 변경' } },
  )
  act(() => useSessionStore.getState().clearSession())
  expect(screen.getByRole('textbox', { name: '미저장 편집' })).toHaveValue(
    '내보낼 변경',
  )
})
it('일시 조회 실패에서 재시도를 제공한다', async () => {
  vi.mocked(getWhiteboardDocumentRequest).mockRejectedValue(
    new Error('network'),
  )
  show()
  expect(
    await screen.findByRole('button', { name: '다시 시도' }),
  ).toBeInTheDocument()
})
