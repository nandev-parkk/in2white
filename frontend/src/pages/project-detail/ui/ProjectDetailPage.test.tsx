import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { Project } from '@/entities/project'
import { useProject } from '@/features/project'

import { ProjectDetailPage } from './ProjectDetailPage'

vi.mock('@/pages/shared/ui/AuthenticatedWorkspaceLayout', () => ({
  AuthenticatedWorkspaceLayout: ({
    children,
  }: {
    children: (context: unknown) => unknown
  }) =>
    children({
      accessToken: 'token-1',
      user: { id: 'user-1', name: '김민지', email: 'a@b.c' },
      selectedWorkspace: { id: 'workspace-1', role: 'owner' },
      selectedWorkspaceId: 'workspace-1',
      onAccessLost: vi.fn(),
    }),
}))

vi.mock('@/features/project', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/project')>()
  return {
    ...actual,
    useProject: vi.fn(),
    useUpdateProject: vi.fn(() => ({
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      error: null,
    })),
    useDeleteProject: vi.fn(() => ({
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      error: null,
    })),
  }
})

vi.mock('@/features/whiteboard-document', () => ({
  WhiteboardDocumentListContent: () => <div data-testid="document-list" />,
}))

const project: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: '2026 브랜드 리뉴얼',
  description: '브랜드 아이덴티티 전면 개편',
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T03:00:00.000Z',
}

function renderPage(onBack = vi.fn()) {
  render(
    <ProjectDetailPage
      workspaceId="workspace-1"
      projectId="project-1"
      onBack={onBack}
    />,
  )
  return onBack
}

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('로딩 중에는 Skeleton을 보여주고 문서 목록을 렌더링하지 않는다', () => {
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never)
    renderPage()

    expect(
      screen.getByTestId('project-detail-header-skeleton'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('document-list')).not.toBeInTheDocument()
  })

  it('프로젝트를 찾을 수 없으면 빈 상태와 목록 이동 버튼을 보여준다', async () => {
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: {
        isAxiosError: true,
        response: { data: { error: { code: 'PROJECT_NOT_FOUND' } } },
      },
      refetch: vi.fn(),
    } as never)
    const onBack = renderPage()

    expect(screen.getByText('프로젝트를 찾을 수 없어요')).toBeInTheDocument()
    expect(screen.queryByTestId('document-list')).not.toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: '프로젝트 목록으로' }),
    )
    expect(onBack).toHaveBeenCalled()
  })

  it('404가 아닌 오류는 다시 시도 버튼을 보여준다', async () => {
    const refetch = vi.fn()
    vi.mocked(useProject).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { isAxiosError: true, response: { status: 500, data: {} } },
      refetch,
    } as never)
    renderPage()

    expect(screen.getByText('프로젝트를 불러오지 못했어요')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(refetch).toHaveBeenCalled()
  })

  it('조회에 성공하면 헤더와 문서 목록을 함께 보여준다', () => {
    vi.mocked(useProject).mockReturnValue({
      data: project,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never)
    renderPage()

    expect(
      screen.getByRole('heading', { name: '2026 브랜드 리뉴얼' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('document-list')).toBeInTheDocument()
  })
})
