import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  listWorkspacesRequest,
  type AdminWorkspaceListItem,
  type ListWorkspacesResponse,
} from '@/entities/workspace'

import { WorkspacesPage } from './WorkspacesPage'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/entities/workspace', () => ({
  listWorkspacesRequest: vi.fn(),
  getWorkspaceRequest: vi.fn(),
  updateWorkspaceRequest: vi.fn(),
  transferWorkspaceOwnerRequest: vi.fn(),
  addWorkspaceMemberRequest: vi.fn(),
  removeWorkspaceMemberRequest: vi.fn(),
  deleteWorkspaceRequest: vi.fn(),
}))

const workspaces: AdminWorkspaceListItem[] = [
  {
    id: 'workspace-1',
    name: '디자인팀',
    isDefault: false,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-21T00:00:00.000Z',
    owner: { id: 'user-1', name: '김하나', email: 'hana@in2white.team' },
    memberCount: 3,
    projectCount: 2,
  },
  {
    id: 'workspace-2',
    name: '김하나의 워크스페이스',
    isDefault: true,
    createdAt: '2026-09-19T00:00:00.000Z',
    updatedAt: '2026-09-19T00:00:00.000Z',
    owner: { id: 'user-1', name: '김하나', email: 'hana@in2white.team' },
    memberCount: 1,
    projectCount: 0,
  },
]

function listResponse(
  overrides?: Partial<ListWorkspacesResponse>,
): ListWorkspacesResponse {
  return {
    workspaces,
    pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    ...overrides,
  }
}

function renderWorkspacesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspacesPage />
    </QueryClientProvider>,
  )
}

describe('WorkspacesPage', () => {
  beforeEach(() => {
    vi.mocked(listWorkspacesRequest).mockReset()
    navigateMock.mockReset()
  })

  it('워크스페이스 목록을 표로 보여준다', async () => {
    vi.mocked(listWorkspacesRequest).mockResolvedValue(listResponse())

    renderWorkspacesPage()

    expect(await screen.findByText('디자인팀')).toBeInTheDocument()
    expect(screen.getByText('김하나의 워크스페이스')).toBeInTheDocument()
    expect(vi.mocked(listWorkspacesRequest).mock.calls[0][0]).toMatchObject({
      page: 1,
    })
  })

  it('이름을 누르면 상세 화면으로 이동한다', async () => {
    vi.mocked(listWorkspacesRequest).mockResolvedValue(listResponse())

    renderWorkspacesPage()

    await userEvent.click(
      await screen.findByRole('button', { name: '디자인팀' }),
    )

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/workspaces/$workspaceId',
      params: { workspaceId: 'workspace-1' },
    })
  })

  it('검색어를 입력하면 검색 조건으로 다시 조회한다', async () => {
    vi.mocked(listWorkspacesRequest).mockResolvedValue(listResponse())

    renderWorkspacesPage()
    await screen.findByText('디자인팀')

    await userEvent.type(screen.getByLabelText('워크스페이스 검색'), '디자인')

    await waitFor(() => {
      expect(listWorkspacesRequest).toHaveBeenCalledWith(
        expect.objectContaining({ search: '디자인', page: 1 }),
      )
    })
  })

  it('결과가 없으면 검색 결과 없음을 보여준다', async () => {
    vi.mocked(listWorkspacesRequest).mockResolvedValue(
      listResponse({
        workspaces: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    )

    renderWorkspacesPage()

    expect(await screen.findByText('워크스페이스가 없어요')).toBeInTheDocument()
  })

  it('조회에 실패하면 오류와 다시 시도 버튼을 보여준다', async () => {
    vi.mocked(listWorkspacesRequest).mockRejectedValue(new Error('network'))

    renderWorkspacesPage()

    expect(
      await screen.findByText('워크스페이스 목록을 불러오지 못했어요'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '다시 시도' }),
    ).toBeInTheDocument()
  })
})
