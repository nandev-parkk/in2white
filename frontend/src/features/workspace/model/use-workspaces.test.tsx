import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createWorkspaceRequest,
  listWorkspacesRequest,
  type WorkspaceSummary,
} from '@/entities/workspace'

import { useCreateWorkspace, useWorkspaces } from './use-workspaces'

vi.mock('@/entities/workspace', () => ({
  createWorkspaceRequest: vi.fn(),
  listWorkspacesRequest: vi.fn(),
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

const createdWorkspaceFixture: WorkspaceSummary = {
  ...workspaceFixture,
  id: 'workspace-2',
  name: '새 팀',
  isDefault: false,
}

function createQueryClientWrapper(queryClient: QueryClient) {
  return function QueryClientWrapper({ children }: React.PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

describe('workspace hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('access token으로 목록을 조회하고 생성 성공 시 목록을 무효화한다', async () => {
    vi.mocked(listWorkspacesRequest).mockResolvedValue([workspaceFixture])
    vi.mocked(createWorkspaceRequest).mockResolvedValue(createdWorkspaceFixture)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(
      () => ({
        list: useWorkspaces('token-1', 'user-1'),
        create: useCreateWorkspace('token-1'),
      }),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await waitFor(() =>
      expect(result.current.list.data).toEqual([workspaceFixture]),
    )
    await act(async () => {
      await result.current.create.mutateAsync('새 팀')
    })

    expect(createWorkspaceRequest).toHaveBeenCalledWith('새 팀', 'token-1')
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['workspaces'],
    })
  })

  it('access token이 바뀌면 이전 사용자의 목록을 재사용하지 않는다', async () => {
    vi.mocked(listWorkspacesRequest).mockImplementation((accessToken) => {
      if (accessToken === 'token-1') return Promise.resolve([workspaceFixture])
      return new Promise<WorkspaceSummary[]>(() => undefined)
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const { result, rerender } = renderHook(
      ({ accessToken, userId }: { accessToken: string; userId: string }) =>
        useWorkspaces(accessToken, userId),
      {
        initialProps: { accessToken: 'token-1', userId: 'user-1' },
        wrapper: createQueryClientWrapper(queryClient),
      },
    )

    await waitFor(() => expect(result.current.data).toEqual([workspaceFixture]))

    rerender({ accessToken: 'token-2', userId: 'user-2' })

    await waitFor(() =>
      expect(listWorkspacesRequest).toHaveBeenLastCalledWith('token-2'),
    )
    expect(result.current.data).toBeUndefined()
  })
})
