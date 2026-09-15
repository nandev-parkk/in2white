import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type React from 'react'

import {
  createWhiteboardDocumentRequest,
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  updateWhiteboardDocumentRequest,
  type ListWhiteboardDocumentsResponse,
} from '@/entities/whiteboard-document'

import {
  useCreateWhiteboardDocument,
  useDeleteWhiteboardDocument,
  useUpdateWhiteboardDocument,
  useWhiteboardDocuments,
} from './use-whiteboard-documents'

vi.mock('@/entities/whiteboard-document', () => ({
  createWhiteboardDocumentRequest: vi.fn(),
  deleteWhiteboardDocumentRequest: vi.fn(),
  listWhiteboardDocumentsRequest: vi.fn(),
  updateWhiteboardDocumentRequest: vi.fn(),
}))

const documentListFixture: ListWhiteboardDocumentsResponse = {
  whiteboardDocuments: [
    {
      id: 'document-1',
      projectId: 'project-1',
      name: '킥오프 화이트보드',
      creatorId: 'user-1',
      creator: { id: 'user-1', name: '김민지' },
      createdAt: '2026-01-12T00:00:00.000Z',
      updatedAt: '2026-01-12T03:00:00.000Z',
    },
  ],
  pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
}

const listParams = { page: 1, limit: 12, search: '' }

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

describe('whiteboard document query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('workspace, project, list params로 문서를 조회한다', async () => {
    vi.mocked(listWhiteboardDocumentsRequest).mockResolvedValue(
      documentListFixture,
    )
    const queryClient = createTestQueryClient()

    const { result } = renderHook(
      () =>
        useWhiteboardDocuments(
          'token-1',
          'workspace-1',
          'project-1',
          listParams,
        ),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await waitFor(() =>
      expect(result.current.data).toEqual(documentListFixture),
    )
    expect(listWhiteboardDocumentsRequest).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      listParams,
      'token-1',
    )
  })

  it('토큰, workspace, project 중 하나라도 없으면 조회하지 않는다', () => {
    const queryClient = createTestQueryClient()

    renderHook(
      () =>
        useWhiteboardDocuments(null, 'workspace-1', 'project-1', listParams),
      { wrapper: createQueryClientWrapper(queryClient) },
    )
    renderHook(
      () => useWhiteboardDocuments('token-1', 'workspace-1', null, listParams),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    expect(listWhiteboardDocumentsRequest).not.toHaveBeenCalled()
  })

  it('생성 성공 시 문서 목록 쿼리를 무효화한다', async () => {
    vi.mocked(createWhiteboardDocumentRequest).mockResolvedValue({
      id: 'document-1',
      projectId: 'project-1',
      name: '킥오프',
      creatorId: 'user-1',
      createdAt: '2026-01-12T00:00:00.000Z',
      updatedAt: '2026-01-12T00:00:00.000Z',
    })
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(
      () => useCreateWhiteboardDocument('token-1', 'workspace-1', 'project-1'),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await result.current.mutateAsync({ name: '킥오프' })

    expect(createWhiteboardDocumentRequest).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      { name: '킥오프' },
      'token-1',
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['whiteboard-documents', 'workspace-1', 'project-1'],
    })
  })

  it('이름 변경 성공 시 문서 목록 쿼리를 무효화한다', async () => {
    vi.mocked(updateWhiteboardDocumentRequest).mockResolvedValue({
      id: 'document-1',
      name: '킥오프 v2',
      updatedAt: '2026-01-12T01:00:00.000Z',
    })
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(
      () => useUpdateWhiteboardDocument('token-1', 'workspace-1', 'project-1'),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await result.current.mutateAsync({
      documentId: 'document-1',
      input: { name: '킥오프 v2' },
    })

    expect(updateWhiteboardDocumentRequest).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      'document-1',
      { name: '킥오프 v2' },
      'token-1',
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['whiteboard-documents', 'workspace-1', 'project-1'],
    })
  })

  it('삭제 성공 시 문서 목록 쿼리를 무효화한다', async () => {
    vi.mocked(deleteWhiteboardDocumentRequest).mockResolvedValue(undefined)
    const queryClient = createTestQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(
      () => useDeleteWhiteboardDocument('token-1', 'workspace-1', 'project-1'),
      { wrapper: createQueryClientWrapper(queryClient) },
    )

    await result.current.mutateAsync('document-1')

    expect(deleteWhiteboardDocumentRequest).toHaveBeenCalledWith(
      'workspace-1',
      'project-1',
      'document-1',
      'token-1',
    )
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['whiteboard-documents', 'workspace-1', 'project-1'],
    })
  })
})
