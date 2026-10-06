import { axiosInstance } from '@/shared/api'

import {
  createProjectRequest,
  deleteProjectRequest,
  getProjectRequest,
  listProjectsRequest,
  updateProjectRequest,
  type Project,
  type ProjectMutationProject,
} from './project'

vi.mock('@/shared/api', () => ({
  axiosInstance: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

const projectFixture: Project = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: '2026 브랜드 리뉴얼',
  description: '브랜드 아이덴티티와 로고 시스템을 새로 정비해요',
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T03:00:00.000Z',
}

const mutationProjectFixture: ProjectMutationProject = {
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: '2026 브랜드 리뉴얼',
  description: '브랜드 아이덴티티와 로고 시스템을 새로 정리해요',
  creatorId: 'user-1',
  createdAt: '2026-01-10T00:00:00.000Z',
  updatedAt: '2026-01-10T03:00:00.000Z',
}

describe('project API requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('프로젝트 목록 조회에 workspace, pagination, search, bearer token을 전달한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: {
        projects: [projectFixture],
        pagination: { page: 2, limit: 20, total: 1, totalPages: 1 },
      },
    })

    await expect(
      listProjectsRequest(
        'workspace-1',
        { page: 2, limit: 20, search: '브랜드' },
        'token-1',
      ),
    ).resolves.toEqual({
      projects: [projectFixture],
      pagination: { page: 2, limit: 20, total: 1, totalPages: 1 },
    })

    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/projects',
      {
        params: { page: 2, limit: 20, search: '브랜드' },
        headers: { Authorization: 'Bearer token-1' },
      },
    )
  })

  it('빈 검색어는 search query를 생략한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: {
        projects: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      },
    })

    await listProjectsRequest(
      'workspace-1',
      { page: 1, limit: 20, search: '   ' },
      'token-1',
    )

    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/projects',
      {
        params: { page: 1, limit: 20 },
        headers: { Authorization: 'Bearer token-1' },
      },
    )
  })

  it('프로젝트 생성·수정·삭제 요청의 경로와 body를 계약대로 만든다', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: { project: projectFixture },
    })
    vi.mocked(axiosInstance.patch).mockResolvedValueOnce({
      data: { project: projectFixture },
    })
    vi.mocked(axiosInstance.delete).mockResolvedValueOnce({ data: undefined })

    await expect(
      createProjectRequest(
        'workspace-1',
        { name: '새 프로젝트', description: null },
        'token-1',
      ),
    ).resolves.toEqual(projectFixture)
    await expect(
      updateProjectRequest(
        'workspace-1',
        'project-1',
        { name: '이름 변경' },
        'token-1',
      ),
    ).resolves.toEqual(projectFixture)
    await expect(
      deleteProjectRequest('workspace-1', 'project-1', 'token-1'),
    ).resolves.toBeUndefined()

    expect(axiosInstance.post).toHaveBeenCalledWith(
      '/workspaces/workspace-1/projects',
      { name: '새 프로젝트', description: null },
      { headers: { Authorization: 'Bearer token-1' } },
    )
    expect(axiosInstance.patch).toHaveBeenCalledWith(
      '/workspaces/workspace-1/projects/project-1',
      { name: '이름 변경' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
    expect(axiosInstance.delete).toHaveBeenCalledWith(
      '/workspaces/workspace-1/projects/project-1',
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('프로젝트 단건 조회에 workspace, project, bearer token을 전달한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: { project: projectFixture },
    })

    await expect(
      getProjectRequest('workspace-1', 'project-1', 'token-1'),
    ).resolves.toEqual(projectFixture)

    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/workspaces/workspace-1/projects/project-1',
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('생성·수정 응답 타입은 목록 응답과 달리 creator 없이 server raw project를 표현한다', () => {
    expect(mutationProjectFixture).not.toHaveProperty('creator')
  })
})
