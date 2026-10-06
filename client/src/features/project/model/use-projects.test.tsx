import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { useSessionStore } from '@/entities/session'

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

  it('새 검색이 끝나면 빈 결과로 교체하고 늦은 이전 응답은 무시한다', async () => {
    let settleOld!: (value: ListProjectsResponse) => void
    let settleNew!: (value: ListProjectsResponse) => void
    vi.mocked(listProjectsRequest)
      .mockResolvedValueOnce(projectListFixture)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settleOld = resolve
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            settleNew = resolve
          }),
      )
    const { result, rerender } = renderHook(
      ({ search }) =>
        useProjects('token-1', 'workspace-1', { page: 1, limit: 20, search }),
      {
        initialProps: { search: '' },
        wrapper: createQueryClientWrapper(createTestQueryClient()),
      },
    )
    await waitFor(() => expect(result.current.data).toEqual(projectListFixture))
    rerender({ search: '이전 검색' })
    rerender({ search: '최신 검색' })
    expect(result.current.data).toEqual(projectListFixture)
    const empty = {
      projects: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    }
    await act(async () => settleNew(empty))
    await waitFor(() => expect(result.current.data).toEqual(empty))
    await act(async () => settleOld(projectListFixture))
    expect(result.current.data).toEqual(empty)
    expect(result.current.isPlaceholderData).toBe(false)
  })

  it('새 검색 실패를 이전 결과의 성공 상태로 숨기지 않는다', async () => {
    vi.mocked(listProjectsRequest)
      .mockResolvedValueOnce(projectListFixture)
      .mockRejectedValueOnce(new Error('network'))
    const { result, rerender } = renderHook(
      ({ search }) =>
        useProjects('token-1', 'workspace-1', { page: 1, limit: 20, search }),
      {
        initialProps: { search: '' },
        wrapper: createQueryClientWrapper(createTestQueryClient()),
      },
    )
    await waitFor(() => expect(result.current.data).toEqual(projectListFixture))
    rerender({ search: '실패 검색' })
    expect(result.current.data).toEqual(projectListFixture)
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
  })

  it('검색 중 이전 결과를 유지하지만 워크스페이스와 계정 변경 시 버린다', async () => {
    useSessionStore.getState().setSession('token-1', {
      id: 'u1',
      name: '사용자',
      email: 'test@example.test',
    })
    vi.mocked(listProjectsRequest)
      .mockResolvedValueOnce(projectListFixture)
      .mockImplementation(() => new Promise(() => {}))
    const { result, rerender } = renderHook(
      ({ workspace, search }) =>
        useProjects('token-1', workspace, { page: 1, limit: 20, search }),
      {
        initialProps: { workspace: 'workspace-1', search: '' },
        wrapper: createQueryClientWrapper(createTestQueryClient()),
      },
    )
    await waitFor(() => expect(result.current.data).toEqual(projectListFixture))
    rerender({ workspace: 'workspace-1', search: '새 검색' })
    expect(result.current.data).toEqual(projectListFixture)
    expect(result.current.isPlaceholderData).toBe(true)
    rerender({ workspace: 'workspace-2', search: '새 검색' })
    expect(result.current.data).toBeUndefined()
    rerender({ workspace: 'workspace-1', search: '' })
    await waitFor(() => expect(result.current.data).toEqual(projectListFixture))
    act(() =>
      useSessionStore.getState().setSession('token-2', {
        id: 'u2',
        name: '다른 사용자',
        email: 'other@example.test',
      }),
    )
    expect(result.current.data).toBeUndefined()
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
