import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { WhiteboardDocument } from '@/entities/whiteboard-document'
import {
  useCreateWhiteboardDocument,
  useDeleteWhiteboardDocument,
  useUpdateWhiteboardDocument,
  useWhiteboardDocuments,
} from '@/features/whiteboard-document'

import { WhiteboardDocumentListContent } from './WhiteboardDocumentListContent'

vi.mock('@/features/whiteboard-document', () => ({
  useCreateWhiteboardDocument: vi.fn(),
  useDeleteWhiteboardDocument: vi.fn(),
  useUpdateWhiteboardDocument: vi.fn(),
  useWhiteboardDocuments: vi.fn(),
}))

vi.mock('@/shared/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const documents: WhiteboardDocument[] = [
  {
    id: 'document-1',
    projectId: 'project-1',
    name: '킥오프 화이트보드',
    creatorId: 'user-1',
    creator: { id: 'user-1', name: '김민지' },
    createdAt: '2026-01-12T00:00:00.000Z',
    updatedAt: '2026-01-12T00:00:00.000Z',
  },
  {
    id: 'document-2',
    projectId: 'project-1',
    name: '로고 스케치 v2',
    creatorId: 'user-2',
    creator: { id: 'user-2', name: '이서준' },
    createdAt: '2026-01-14T00:00:00.000Z',
    updatedAt: '2026-01-14T00:00:00.000Z',
  },
]

function mockMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  }
}

function mockQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      whiteboardDocuments: documents,
      pagination: { page: 1, limit: 12, total: 2, totalPages: 1 },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  }
}

function renderContent(
  props: Partial<
    React.ComponentProps<typeof WhiteboardDocumentListContent>
  > = {},
) {
  render(
    <WhiteboardDocumentListContent
      accessToken="token-1"
      workspaceId="workspace-1"
      projectId="project-1"
      userId="user-1"
      {...props}
    />,
  )
}

describe('WhiteboardDocumentListContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useWhiteboardDocuments).mockReturnValue(mockQuery() as never)
    vi.mocked(useCreateWhiteboardDocument).mockReturnValue(
      mockMutation() as never,
    )
    vi.mocked(useUpdateWhiteboardDocument).mockReturnValue(
      mockMutation() as never,
    )
    vi.mocked(useDeleteWhiteboardDocument).mockReturnValue(
      mockMutation() as never,
    )
  })

  it('기본은 카드 보기이고 목록 보기로 전환하면 테이블을 보여준다', async () => {
    renderContent()

    expect(screen.getByTestId('whiteboard-document-grid')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '목록 보기' }))

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(
      screen.queryByTestId('whiteboard-document-grid'),
    ).not.toBeInTheDocument()
  })

  it('검색어를 입력하면 첫 페이지로 조회한다', async () => {
    renderContent()

    await userEvent.type(
      screen.getByRole('searchbox', { name: '화이트보드 검색' }),
      '킥오프',
    )

    expect(useWhiteboardDocuments).toHaveBeenLastCalledWith(
      'token-1',
      'workspace-1',
      'project-1',
      { page: 1, limit: 12, search: '킥오프' },
    )
  })

  it('Owner가 아니고 생성자도 아니면 메뉴를 렌더링하지 않는다', () => {
    renderContent({ userId: 'user-1', workspaceRole: 'member' })

    expect(
      screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '로고 스케치 v2 메뉴' }),
    ).not.toBeInTheDocument()
  })

  it('Owner는 모든 문서의 메뉴를 볼 수 있다', () => {
    renderContent({ userId: 'user-3', workspaceRole: 'owner' })

    expect(
      screen.getByRole('button', { name: '로고 스케치 v2 메뉴' }),
    ).toBeInTheDocument()
  })

  it('화이트보드를 만들면 생성 요청을 보내고 Dialog를 닫는다', async () => {
    const createMutation = mockMutation()
    vi.mocked(useCreateWhiteboardDocument).mockReturnValue(
      createMutation as never,
    )
    renderContent()

    await userEvent.click(
      screen.getByRole('button', { name: '화이트보드 생성' }),
    )

    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('이름'), '새 보드')
    await userEvent.click(
      within(dialog).getByRole('button', { name: '만들기' }),
    )

    expect(createMutation.mutateAsync).toHaveBeenCalledWith({ name: '새 보드' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('생성이 실패하면 Dialog를 닫지 않고 오류를 보여준다', async () => {
    vi.mocked(useCreateWhiteboardDocument).mockReturnValue(
      mockMutation({
        mutateAsync: vi.fn().mockRejectedValue(new Error('failed')),
        error: new Error('failed'),
      }) as never,
    )
    renderContent()

    await userEvent.click(
      screen.getByRole('button', { name: '화이트보드 생성' }),
    )

    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('이름'), '새 보드')
    await userEvent.click(
      within(dialog).getByRole('button', { name: '만들기' }),
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      '화이트보드를 만들지 못했어요',
    )
  })

  it('이름 변경을 확정하면 문서 id와 새 이름을 전달한다', async () => {
    const updateMutation = mockMutation()
    vi.mocked(useUpdateWhiteboardDocument).mockReturnValue(
      updateMutation as never,
    )
    renderContent({ workspaceRole: 'owner' })

    await userEvent.click(
      screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '이름 변경' }))

    const dialog = screen.getByRole('dialog')
    await userEvent.clear(within(dialog).getByLabelText('이름'))
    await userEvent.type(within(dialog).getByLabelText('이름'), '킥오프 v2')
    await userEvent.click(within(dialog).getByRole('button', { name: '저장' }))

    expect(updateMutation.mutateAsync).toHaveBeenCalledWith({
      documentId: 'document-1',
      input: { name: '킥오프 v2' },
    })
  })

  it('삭제를 확정하면 문서 id를 전달한다', async () => {
    const deleteMutation = mockMutation()
    vi.mocked(useDeleteWhiteboardDocument).mockReturnValue(
      deleteMutation as never,
    )
    renderContent({ workspaceRole: 'owner' })

    await userEvent.click(
      screen.getByRole('button', { name: '킥오프 화이트보드 메뉴' }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: '삭제' }))

    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    expect(deleteMutation.mutateAsync).toHaveBeenCalledWith('document-1')
  })

  it('문서가 없으면 빈 상태를 보여준다', () => {
    vi.mocked(useWhiteboardDocuments).mockReturnValue(
      mockQuery({
        data: {
          whiteboardDocuments: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        },
      }) as never,
    )
    renderContent()

    expect(screen.getByText('아직 화이트보드가 없어요')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '새 화이트보드 만들기' }),
    ).toBeInTheDocument()
  })

  it('검색 결과가 없으면 검색 전용 빈 상태를 보여준다', async () => {
    renderContent()

    vi.mocked(useWhiteboardDocuments).mockReturnValue(
      mockQuery({
        data: {
          whiteboardDocuments: [],
          pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
        },
      }) as never,
    )

    await userEvent.type(
      screen.getByRole('searchbox', { name: '화이트보드 검색' }),
      '없는이름',
    )

    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '검색 결과 초기화' }),
    ).toBeInTheDocument()
  })

  it('목록 조회가 실패하면 다시 시도 버튼을 보여준다', async () => {
    const refetch = vi.fn()
    vi.mocked(useWhiteboardDocuments).mockReturnValue(
      mockQuery({ isError: true, data: undefined, refetch }) as never,
    )
    renderContent()

    expect(
      screen.getByText('화이트보드를 불러오지 못했어요'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(refetch).toHaveBeenCalled()
  })
})
