import { axiosInstance } from '@/shared/api'

import {
  createWorkspaceRequest,
  deleteWorkspaceRequest,
  listWorkspacesRequest,
  updateWorkspaceRequest,
  type WorkspaceSummary,
} from './workspace'

vi.mock('@/shared/api', () => ({
  axiosInstance: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

const workspaceFixture: WorkspaceSummary = {
  id: 'workspace-1',
  name: 'My Workspace',
  ownerId: 'user-1',
  isDefault: true,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
  role: 'owner',
}

const createdWorkspaceResponseFixture = {
  id: 'workspace-2',
  name: '새 팀',
  ownerId: 'user-1',
  isDefault: false,
  createdAt: '2026-09-08T00:00:00.000Z',
  updatedAt: '2026-09-08T00:00:00.000Z',
}

const createdWorkspaceFixture: WorkspaceSummary = {
  ...createdWorkspaceResponseFixture,
  role: 'owner',
}

describe('workspace API requests', () => {
  it('워크스페이스 목록을 Bearer 토큰으로 조회한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: { workspaces: [workspaceFixture] },
    })

    await expect(listWorkspacesRequest('token-1')).resolves.toEqual([
      workspaceFixture,
    ])
    expect(axiosInstance.get).toHaveBeenCalledWith('/workspaces', {
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('워크스페이스를 생성하고 owner 역할을 붙여 반환한다', async () => {
    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: { workspace: createdWorkspaceResponseFixture },
    })

    await expect(createWorkspaceRequest('새 팀', 'token-1')).resolves.toEqual(
      createdWorkspaceFixture,
    )
    expect(axiosInstance.post).toHaveBeenCalledWith(
      '/workspaces',
      { name: '새 팀' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('워크스페이스 이름을 수정하고 owner 역할을 붙여 반환한다', async () => {
    const updatedWorkspaceResponse = {
      ...createdWorkspaceResponseFixture,
      id: workspaceFixture.id,
      name: '브랜드 스튜디오 2',
    }
    vi.mocked(axiosInstance.patch).mockResolvedValueOnce({
      data: { workspace: updatedWorkspaceResponse },
    })

    await expect(
      updateWorkspaceRequest(
        workspaceFixture.id,
        '브랜드 스튜디오 2',
        'token-1',
      ),
    ).resolves.toEqual({ ...updatedWorkspaceResponse, role: 'owner' })
    expect(axiosInstance.patch).toHaveBeenCalledWith(
      '/workspaces/workspace-1',
      { name: '브랜드 스튜디오 2' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('워크스페이스를 삭제하고 응답 본문 없이 완료한다', async () => {
    vi.mocked(axiosInstance.delete).mockResolvedValueOnce({ data: undefined })

    await expect(
      deleteWorkspaceRequest('workspace-1', 'token-1'),
    ).resolves.toBe(undefined)
    expect(axiosInstance.delete).toHaveBeenCalledWith(
      '/workspaces/workspace-1',
      {
        headers: { Authorization: 'Bearer token-1' },
      },
    )
  })
})
