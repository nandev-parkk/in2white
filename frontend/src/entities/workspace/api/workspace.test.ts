import { axiosInstance } from '@/shared/api'

import {
  createWorkspaceRequest,
  listWorkspacesRequest,
  type WorkspaceSummary,
} from './workspace'

vi.mock('@/shared/api', () => ({
  axiosInstance: { get: vi.fn(), post: vi.fn() },
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
})
