import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  deleteProjectRequest,
  listProjectsRequest,
  restoreProjectRequest,
  type AdminProjectListItem,
  type ListProjectsResponse,
} from '@/entities/project'
import { toast } from '@in2white/ui/toast'

import { ProjectsPage } from './ProjectsPage'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/entities/project', () => ({
  listProjectsRequest: vi.fn(),
  getProjectRequest: vi.fn(),
  deleteProjectRequest: vi.fn(),
  restoreProjectRequest: vi.fn(),
}))

vi.mock('@in2white/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const workspace = { id: 'workspace-1', name: '디자인팀' }
const creator = { id: 'user-1', name: '김하나', email: 'hana@in2white.team' }

const projects: AdminProjectListItem[] = [
  {
    id: 'project-1',
    name: '랜딩 리뉴얼',
    description: '9월 랜딩 개편',
    deletedAt: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    workspace,
    creator,
    whiteboardDocumentCount: 4,
  },
  {
    id: 'project-2',
    name: '지난 캠페인',
    description: null,
    deletedAt: '2026-09-28T00:00:00.000Z',
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z',
    workspace,
    creator,
    whiteboardDocumentCount: 0,
  },
]

function listResponse(
  overrides?: Partial<ListProjectsResponse>,
): ListProjectsResponse {
  return {
    projects,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    ...overrides,
  }
}

function renderProjectsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsPage />
    </QueryClientProvider>,
  )
}

/* Radix Select는 jsdom에 없는 포인터 API를 쓴다. */
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
})

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.mocked(listProjectsRequest).mockReset()
    vi.mocked(deleteProjectRequest).mockReset()
    vi.mocked(restoreProjectRequest).mockReset()
    vi.mocked(toast.success).mockReset()
    navigateMock.mockReset()
  })

  /* 삭제된 프로젝트가 기본으로 보여야 복구 대상을 찾을 수 있다. */
  it('삭제된 프로젝트까지 포함해 목록을 보여준다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(listResponse())

    renderProjectsPage()

    expect(await screen.findByText('랜딩 리뉴얼')).toBeInTheDocument()
    expect(screen.getByText('지난 캠페인')).toBeInTheDocument()
    expect(screen.getByText('삭제됨')).toBeInTheDocument()
    expect(vi.mocked(listProjectsRequest).mock.calls[0][0]).toMatchObject({
      page: 1,
      status: 'all',
    })
  })

  it('이름을 누르면 상세 화면으로 이동한다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(listResponse())

    renderProjectsPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '랜딩 리뉴얼' }),
    )

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/projects/$projectId',
      params: { projectId: 'project-1' },
    })
  })

  it('삭제 상태 필터를 고르면 그 조건으로 다시 조회한다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(listResponse())

    renderProjectsPage()
    await screen.findByText('랜딩 리뉴얼')

    await userEvent.click(screen.getByRole('combobox', { name: '삭제 여부' }))
    await userEvent.click(await screen.findByRole('option', { name: '삭제됨' }))

    await waitFor(() => {
      expect(listProjectsRequest).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'deleted', page: 1 }),
      )
    })
  })

  it('검색어를 입력하면 검색 조건으로 다시 조회한다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(listResponse())

    renderProjectsPage()
    await screen.findByText('랜딩 리뉴얼')

    await userEvent.type(screen.getByLabelText('프로젝트 검색'), '랜딩')

    await waitFor(() => {
      expect(listProjectsRequest).toHaveBeenCalledWith(
        expect.objectContaining({ search: '랜딩', page: 1 }),
      )
    })
  })

  /* 소프트 삭제라 문구가 하드 삭제와 다르다 — 복구할 수 있음을 알린다. */
  it('삭제하면 복구할 수 있다는 문구를 보여주고 삭제 API를 호출한다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(listResponse())
    vi.mocked(deleteProjectRequest).mockResolvedValue(undefined)

    renderProjectsPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '랜딩 리뉴얼 삭제' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('필요하면 다시 복구할 수 있어요')
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => {
      expect(deleteProjectRequest).toHaveBeenCalledWith('project-1')
    })
    expect(toast.success).toHaveBeenCalledWith('프로젝트를 삭제했어요')
  })

  it('삭제된 프로젝트는 복구 버튼을 보여주고 복구 API를 호출한다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(listResponse())
    vi.mocked(restoreProjectRequest).mockResolvedValue({
      ...projects[1],
      deletedAt: null,
    })

    renderProjectsPage()

    expect(
      await screen.findByRole('button', { name: '지난 캠페인 복구' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '지난 캠페인 삭제' }),
    ).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: '지난 캠페인 복구' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '복구' }))

    await waitFor(() => {
      expect(restoreProjectRequest).toHaveBeenCalledWith('project-2')
    })
    expect(toast.success).toHaveBeenCalledWith('프로젝트를 복구했어요')
  })

  /* 마지막 페이지의 유일한 항목을 삭제하면 그 페이지는 사라진다. 빈 표에 남겨두지 않는다. */
  it('삭제로 페이지가 사라지면 이전 페이지를 조회한다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(
      listResponse({
        projects: [projects[0]],
        pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
      }),
    )

    renderProjectsPage()
    await screen.findByText('랜딩 리뉴얼')

    await userEvent.click(screen.getByRole('button', { name: '다음 페이지' }))
    await waitFor(() => {
      expect(listProjectsRequest).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      )
    })

    vi.mocked(listProjectsRequest).mockResolvedValue(
      listResponse({
        projects: [],
        pagination: { page: 2, limit: 1, total: 1, totalPages: 1 },
      }),
    )
    vi.mocked(deleteProjectRequest).mockResolvedValue(undefined)

    await userEvent.click(
      screen.getByRole('button', { name: '랜딩 리뉴얼 삭제' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => {
      expect(listProjectsRequest).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1 }),
      )
    })
  })

  it('결과가 없으면 빈 상태를 보여준다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(
      listResponse({
        projects: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    )

    renderProjectsPage()

    expect(await screen.findByText('프로젝트가 없어요')).toBeInTheDocument()
  })

  it('조회에 실패하면 오류와 다시 시도 버튼을 보여준다', async () => {
    vi.mocked(listProjectsRequest).mockRejectedValue(new Error('network'))

    renderProjectsPage()

    expect(
      await screen.findByText('프로젝트 목록을 불러오지 못했어요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })
})
