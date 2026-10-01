import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  restoreWhiteboardDocumentRequest,
  type AdminWhiteboardDocument,
  type ListWhiteboardDocumentsResponse,
} from '@/entities/whiteboard-document'
import { toast } from '@in2white/ui/toast'

import { WhiteboardDocumentsPage } from './WhiteboardDocumentsPage'

vi.mock('@/entities/whiteboard-document', () => ({
  listWhiteboardDocumentsRequest: vi.fn(),
  deleteWhiteboardDocumentRequest: vi.fn(),
  restoreWhiteboardDocumentRequest: vi.fn(),
}))

vi.mock('@in2white/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const workspace = { id: 'workspace-1', name: '디자인팀' }
const creator = { id: 'user-1', name: '김하나', email: 'hana@in2white.team' }

const documents: AdminWhiteboardDocument[] = [
  {
    id: 'document-1',
    name: '스프린트 보드',
    deletedAt: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    project: { id: 'project-1', name: '랜딩 리뉴얼', deletedAt: null },
    workspace,
    creator,
  },
  {
    id: 'document-2',
    name: '지난 회고',
    deletedAt: '2026-09-28T00:00:00.000Z',
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    project: {
      id: 'project-2',
      name: '지난 캠페인',
      deletedAt: '2026-09-27T00:00:00.000Z',
    },
    workspace,
    creator,
  },
]

function listResponse(
  overrides?: Partial<ListWhiteboardDocumentsResponse>,
): ListWhiteboardDocumentsResponse {
  return {
    whiteboardDocuments: documents,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    ...overrides,
  }
}

function renderWhiteboardDocumentsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WhiteboardDocumentsPage />
    </QueryClientProvider>,
  )
}

/* Radix Select는 jsdom에 없는 포인터 API를 쓴다. */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

describe('WhiteboardDocumentsPage', () => {
  beforeEach(() => {
    vi.mocked(listWhiteboardDocumentsRequest).mockReset()
    vi.mocked(deleteWhiteboardDocumentRequest).mockReset()
    vi.mocked(restoreWhiteboardDocumentRequest).mockReset()
    vi.mocked(toast.success).mockReset()
  })

  it('프로젝트·워크스페이스와 함께 목록을 보여준다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue(listResponse())

    renderWhiteboardDocumentsPage()

    expect(await screen.findByText('스프린트 보드')).toBeInTheDocument()
    expect(screen.getByText('랜딩 리뉴얼')).toBeInTheDocument()
    expect(screen.getAllByText('디자인팀')).toHaveLength(2)
    expect(
      vi.mocked(listWhiteboardDocumentsRequest).mock.calls[0][0],
    ).toMatchObject({ page: 1, status: 'all' })
  })

  /* 프로젝트가 삭제된 문서는 복구해도 제품에서 보이지 않는다. 표에서 먼저 알린다. */
  it('프로젝트가 삭제된 문서에는 프로젝트 삭제 배지를 보여준다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue(listResponse())

    renderWhiteboardDocumentsPage()

    expect(await screen.findByText('프로젝트 삭제됨')).toBeInTheDocument()
  })

  it('삭제 상태 필터를 고르면 그 조건으로 다시 조회한다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue(listResponse())

    renderWhiteboardDocumentsPage()
    await screen.findByText('스프린트 보드')

    await userEvent.click(screen.getByRole('combobox', { name: '삭제 여부' }))
    await userEvent.click(await screen.findByRole('option', { name: '삭제됨' }))

    await waitFor(() => {
      expect(listWhiteboardDocumentsRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'deleted', page: 1 }),
      )
    })
  })

  it('검색어를 입력하면 검색 조건으로 다시 조회한다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue(listResponse())

    renderWhiteboardDocumentsPage()
    await screen.findByText('스프린트 보드')

    await userEvent.type(
      screen.getByLabelText('화이트보드 문서 검색'),
      '스프린트',
    )

    await waitFor(() => {
      expect(listWhiteboardDocumentsRequest).toHaveBeenCalledWith(
        expect.objectContaining({ search: '스프린트', page: 1 }),
      )
    })
  })

  it('삭제하면 복구할 수 있다는 문구를 보여주고 삭제 API를 호출한다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue(listResponse())
    vi.mocked(deleteWhiteboardDocumentRequest).mockResolvedValue(undefined)

    renderWhiteboardDocumentsPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '스프린트 보드 삭제' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('필요하면 다시 복구할 수 있어요')
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => {
      expect(deleteWhiteboardDocumentRequest).toHaveBeenCalledWith('document-1')
    })
    expect(toast.success).toHaveBeenCalledWith('화이트보드 문서를 삭제했어요')
  })

  /* 프로젝트가 삭제된 상태의 복구는 반쪽짜리다. 복구를 막지 않고 한계를 알린다. */
  it('프로젝트가 삭제된 문서를 복구할 때 프로젝트도 복구해야 한다고 알린다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue(listResponse())
    vi.mocked(restoreWhiteboardDocumentRequest).mockResolvedValue({
      ...documents[1],
      deletedAt: null,
    })

    renderWhiteboardDocumentsPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '지난 회고 복구' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('프로젝트도 복구해야 보입니다')
    await userEvent.click(within(dialog).getByRole('button', { name: '복구' }))

    await waitFor(() => {
      expect(restoreWhiteboardDocumentRequest).toHaveBeenCalledWith(
        'document-2',
      )
    })
    expect(toast.success).toHaveBeenCalledWith('화이트보드 문서를 복구했어요')
  })

  it('결과가 없으면 빈 상태를 보여준다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue(
      listResponse({
        whiteboardDocuments: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    )

    renderWhiteboardDocumentsPage()

    expect(
      await screen.findByText('화이트보드 문서가 없어요'),
    ).toBeInTheDocument()
  })

  it('조회에 실패하면 오류와 다시 시도 버튼을 보여준다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockRejectedValue(
      new Error('network'),
    )

    renderWhiteboardDocumentsPage()

    expect(
      await screen.findByText('화이트보드 문서 목록을 불러오지 못했어요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })
})
