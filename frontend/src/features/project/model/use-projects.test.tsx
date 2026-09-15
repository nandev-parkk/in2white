import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'

import {
  createProjectRequest,
  deleteProjectRequest,
  getProjectRequest,
  listProjectsRequest,
  updateProjectRequest,
  type ListProjectsResponse,
  type Project,
} from '@/entities/project'

import {
  useCreateProject,
  useDeleteProject,
  useProject,
  useProjects,
  useUpdateProject,
} from './use-projects'

vi.mock('@/entities/project', () => ({
  createProjectRequest: vi.fn(),
  deleteProjectRequest: vi.fn(),
  getProjectRequest: vi.fn(),
  listProjectsRequest: vi.fn(),
  updateProjectRequest: vi.fn(),
}))

const projectFixture: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: '2026 브랜드 리뉴얼',
  description: null,
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T03:00:00.000Z',
}

const projectListFixture: ListProjectsResponse = {
  projects: [projectFixture],
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function createQueryClientWrapper(queryClient: QueryClient) {
  return function QueryClientWrapper({ children }: React.PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('project query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('workspace와 list params로 프로젝트를 조회한다', async () => {
    vi.mocked(listProjectsRequest).mockResolvedValue(projectListFixture)
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () =>
        useProjects('token-1', 'workspace-1', {
          page: 1,
          limit: 20,
          search: '',
        }),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await waitFor(() => expect(result.current.data).toEqual(projectListFixture))
    expect(listProjectsRequest).toHaveBeenCalledWith(
      'workspace-1',
      { page: 1, limit: 20, search: '' },
      'token-1',
    )
  })

  it('인증 토큰이나 workspace가 없으면 목록 조회를 실행하지 않는다', async () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useProjects(null, null, { page: 1, limit: 20, search: '' }),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(listProjectsRequest).not.toHaveBeenCalled()
  })

  it('생성·수정·삭제 성공 시 workspace 프로젝트 query를 무효화한다', async () => {
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(createProjectRequest).mockResolvedValue(projectFixture)
    vi.mocked(updateProjectRequest).mockResolvedValue(projectFixture)
    vi.mocked(deleteProjectRequest).mockResolvedValue()

    const { result } = renderHook(
      () => ({
        create: useCreateProject('token-1', 'workspace-1'),
        update: useUpdateProject('token-1', 'workspace-1'),
        remove: useDeleteProject('token-1', 'workspace-1'),
      }),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await act(async () => {
      await result.current.create.mutateAsync({
        name: '새 프로젝트',
        description: null,
      })
      await result.current.update.mutateAsync({
        projectId: 'project-1',
        input: { name: '변경' },
      })
      await result.current.remove.mutateAsync('project-1')
    })

    expect(invalidateQueries).toHaveBeenCalledTimes(3)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['projects', 'workspace-1'],
    })
  })

  it('프로젝트 단건 조회는 project 키를 쓴다', async () => {
    vi.mocked(getProjectRequest).mockResolvedValue(projectFixture)
    const queryClient = createTestQueryClient()

    renderHook(() => useProject('token-1', 'workspace-1', 'project-1'), {
      wrapper: createQueryClientWrapper(queryClient),
    })

    await waitFor(() => {
      expect(getProjectRequest).toHaveBeenCalledWith(
        'workspace-1',
        'project-1',
        'token-1',
      )
    })
  })

  it('projectId가 없으면 단건 조회를 하지 않는다', () => {
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () => useProject('token-1', 'workspace-1', null),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(getProjectRequest).not.toHaveBeenCalled()
  })
})
