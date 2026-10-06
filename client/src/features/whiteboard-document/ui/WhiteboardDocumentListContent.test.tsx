import { act, fireEvent, render, screen, within } from '@testing-library/react'
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

vi.mock('@in2white/ui/toast', () => ({
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
  afterEach(() => vi.useRealTimers())
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

  it('상세에서 이어진 대기는 재지연 없이 문서 카드와 행을 표시한다', () => {
    vi.useFakeTimers()
    vi.mocked(useWhiteboardDocuments).mockReturnValue(
      mockQuery({ data: undefined, isLoading: true }) as never,
    )
    renderContent({ loadingStartedAt: Date.now() - 350 })
    expect(
      screen.getByRole('status', { name: '화이트보드를 불러오는 중' }),
    ).toBeVisible()
    expect(
      document.querySelectorAll('[data-slot="preview-skeleton"]'),
    ).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: '목록 보기' }))
    expect(screen.getAllByRole('row', { hidden: true })).toHaveLength(6)
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByRole('status')).toBeVisible()
  })

  it('빈 검색을 지워도 새 응답 전에는 화이트보드 없음으로 바꾸지 않는다', async () => {
    const empty = mockQuery({
      data: {
        whiteboardDocuments: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
      },
    })
    vi.mocked(useWhiteboardDocuments).mockReturnValue(empty as never)
    renderContent()
    await userEvent.type(screen.getByRole('searchbox'), '없는 검색')
    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
    vi.mocked(useWhiteboardDocuments).mockReturnValue({
      ...empty,
      isPlaceholderData: true,
      isFetching: true,
    } as never)
    await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(screen.getByText('검색 결과가 없어요')).toBeInTheDocument()
    expect(
      screen.queryByText('아직 화이트보드가 없어요'),
    ).not.toBeInTheDocument()
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
    // user-event의 body 포커스 해제로 Radix 메뉴가 닫히는 것을 막는다.
    document.documentElement.tabIndex = -1
    document.documentElement.focus()

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
    // user-event의 body 포커스 해제로 Radix 메뉴가 닫히는 것을 막는다.
    document.documentElement.tabIndex = -1
    document.documentElement.focus()

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

    const failure = screen.getByRole('alert')
    expect(failure).toHaveTextContent('화이트보드를 불러오지 못했어요')
    expect(failure).toHaveTextContent('잠시 후 다시 시도해보세요')
    expect(failure.querySelector('.lucide-circle-alert')).toHaveClass(
      'text-status-danger',
      'size-8',
    )
    expect(failure).toHaveClass('min-h-48')

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(refetch).toHaveBeenCalled()
  })
})
