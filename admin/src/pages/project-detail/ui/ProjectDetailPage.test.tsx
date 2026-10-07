import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  deleteProjectRequest,
  getProjectRequest,
  restoreProjectRequest,
  type AdminProjectDetail,
} from '@/entities/project'
import {
  deleteWhiteboardDocumentRequest,
  restoreWhiteboardDocumentRequest,
} from '@/entities/whiteboard-document'
import { toast } from '@in2white/ui/toast'

import { ProjectDetailPage } from './ProjectDetailPage'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))

vi.mock('@/entities/project', () => ({
  listProjectsRequest: vi.fn(),
  getProjectRequest: vi.fn(),
  deleteProjectRequest: vi.fn(),
  restoreProjectRequest: vi.fn(),
}))

vi.mock('@/entities/whiteboard-document', () => ({
  listWhiteboardDocumentsRequest: vi.fn(),
  deleteWhiteboardDocumentRequest: vi.fn(),
  restoreWhiteboardDocumentRequest: vi.fn(),
}))

vi.mock('@in2white/ui/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const project = {
  id: 'project-1',
  name: '랜딩 리뉴얼',
  description: '9월 랜딩 개편',
  deletedAt: null,
  createdAt: '2026-09-20T00:00:00.000Z',
  updatedAt: '2026-09-21T00:00:00.000Z',
  workspace: { id: 'workspace-1', name: '디자인팀' },
  creator: { id: 'user-1', name: '김하나', email: 'hana@in2white.team' },
}

function detail(overrides?: Partial<AdminProjectDetail>): AdminProjectDetail {
  return {
    project,
    whiteboardDocuments: [
      {
        id: 'document-1',
        name: '스프린트 보드',
        creator: { id: 'user-1', name: '김하나' },
        deletedAt: null,
        createdAt: '2026-09-22T00:00:00.000Z',
        updatedAt: '2026-09-23T00:00:00.000Z',
      },
      {
        id: 'document-2',
        name: '지난 회고',
        creator: { id: 'user-2', name: '이두리' },
        deletedAt: '2026-09-28T00:00:00.000Z',
        createdAt: '2026-09-21T00:00:00.000Z',
        updatedAt: '2026-09-28T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

function renderProjectDetailPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectDetailPage projectId="project-1" />
    </QueryClientProvider>,
  )
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getProjectRequest).mockReset()
    vi.mocked(deleteProjectRequest).mockReset()
    vi.mocked(restoreProjectRequest).mockReset()
    vi.mocked(deleteWhiteboardDocumentRequest).mockReset()
    vi.mocked(restoreWhiteboardDocumentRequest).mockReset()
    vi.mocked(toast.success).mockReset()
    navigateMock.mockReset()
  })

  it('기본 정보와 문서 목록을 보여준다', async () => {
    vi.mocked(getProjectRequest).mockResolvedValue(detail())

    renderProjectDetailPage()

    expect(await screen.findByText('랜딩 리뉴얼')).toBeInTheDocument()
    expect(screen.getByText('9월 랜딩 개편')).toBeInTheDocument()
    expect(screen.getByText('디자인팀')).toBeInTheDocument()
    expect(screen.getByText('스프린트 보드')).toBeInTheDocument()
    expect(screen.getByText('지난 회고')).toBeInTheDocument()
    expect(getProjectRequest).toHaveBeenCalledWith('project-1')
  })

  /* 소프트 삭제라 삭제 뒤에도 이 화면에 머문다 — 바로 복구할 수 있어야 한다. */
  it('삭제하면 목록으로 보내지 않고 상세에 머문다', async () => {
    vi.mocked(getProjectRequest).mockResolvedValue(detail())
    vi.mocked(deleteProjectRequest).mockResolvedValue(undefined)

    renderProjectDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '프로젝트 삭제' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('필요하면 다시 복구할 수 있어요')
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => {
      expect(deleteProjectRequest).toHaveBeenCalledWith('project-1')
    })
    expect(toast.success).toHaveBeenCalledWith('프로젝트를 삭제했어요')
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('삭제된 프로젝트에는 삭제 안내와 복구 버튼만 보여준다', async () => {
    vi.mocked(getProjectRequest).mockResolvedValue(
      detail({
        project: { ...project, deletedAt: '2026-09-28T00:00:00.000Z' },
      }),
    )
    vi.mocked(restoreProjectRequest).mockResolvedValue(project)

    renderProjectDetailPage()

    expect(
      await screen.findByText(/삭제되어 사용자에게 보이지 않아요/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '프로젝트 삭제' }),
    ).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '프로젝트 복구' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '복구' }))

    await waitFor(() => {
      expect(restoreProjectRequest).toHaveBeenCalledWith('project-1')
    })
    expect(toast.success).toHaveBeenCalledWith('프로젝트를 복구했어요')
  })

  it('문서를 삭제하면 문서 삭제 API를 호출한다', async () => {
    vi.mocked(getProjectRequest).mockResolvedValue(detail())
    vi.mocked(deleteWhiteboardDocumentRequest).mockResolvedValue(undefined)

    renderProjectDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '스프린트 보드 삭제' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '삭제' }))

    await waitFor(() => {
      expect(deleteWhiteboardDocumentRequest).toHaveBeenCalledWith('document-1')
    })
    expect(toast.success).toHaveBeenCalledWith('화이트보드 문서를 삭제했어요')
  })

  it('삭제된 문서를 복구하면 문서 복구 API를 호출한다', async () => {
    vi.mocked(getProjectRequest).mockResolvedValue(detail())
    vi.mocked(restoreWhiteboardDocumentRequest).mockResolvedValue({
      id: 'document-2',
      name: '지난 회고',
      deletedAt: null,
      createdAt: '2026-09-21T00:00:00.000Z',
      updatedAt: '2026-09-29T00:00:00.000Z',
      project: { id: 'project-1', name: '랜딩 리뉴얼', deletedAt: null },
      workspace: { id: 'workspace-1', name: '디자인팀' },
      creator: { id: 'user-2', name: '이두리', email: 'duri@in2white.team' },
    })

    renderProjectDetailPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '지난 회고 복구' }),
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: '복구' }))

    await waitFor(() => {
      expect(restoreWhiteboardDocumentRequest).toHaveBeenCalledWith(
        'document-2',
      )
    })
    expect(toast.success).toHaveBeenCalledWith('화이트보드 문서를 복구했어요')
  })

  it('없는 프로젝트면 찾을 수 없다고 알린다', async () => {
    vi.mocked(getProjectRequest).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 404,
        data: {
          error: { code: 'PROJECT_NOT_FOUND', message: '없는 프로젝트' },
        },
      },
    })

    renderProjectDetailPage()

    expect(
      await screen.findByText('프로젝트를 찾을 수 없어요'),
    ).toBeInTheDocument()
  })

  it('조회에 실패하면 오류를 보여준다', async () => {
    vi.mocked(getProjectRequest).mockRejectedValue(new Error('network'))

    renderProjectDetailPage()

    expect(
      await screen.findByText('프로젝트 정보를 불러오지 못했어요'),
    ).toBeInTheDocument()
  })
})

it('어드민 접두사 뒤에 실제 프로젝트 이름만 표시한다', async () => {
  vi.mocked(getProjectRequest).mockResolvedValue(detail())
  renderProjectDetailPage()
  expect(document.title).toBe('in2white admin | 프로젝트 상세')
  await waitFor(() =>
    expect(document.title).toBe(`in2white admin | ${project.name}`),
  )
})
