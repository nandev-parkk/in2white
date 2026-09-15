import { beforeEach, describe, expect, it, vi } from 'vitest'

import { axiosInstance } from '@/shared/api'

import {
  createWhiteboardDocumentRequest,
  deleteWhiteboardDocumentRequest,
  listWhiteboardDocumentsRequest,
  updateWhiteboardDocumentRequest,
  type WhiteboardDocument,
} from './whiteboard-document'

vi.mock('@/shared/api', () => ({
  axiosInstance: {
    delete: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}))

const documentFixture: WhiteboardDocument = {
  id: 'document-1',
  projectId: 'project-1',
  name: '킥오프 화이트보드',
  creatorId: 'user-1',
  creator: { id: 'user-1', name: '김민지' },
  createdAt: '2026-01-12T00:00:00.000Z',
  updatedAt: '2026-01-12T03:00:00.000Z',
}

const LIST_URL =
  '/workspaces/workspace-1/projects/project-1/whiteboard-documents'

describe('whiteboard document API requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('목록 조회에 페이지, 검색어, bearer token을 전달한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: {
        whiteboardDocuments: [documentFixture],
        pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
      },
    })

    await expect(
      listWhiteboardDocumentsRequest(
        'workspace-1',
        'project-1',
        { page: 1, limit: 12, search: '킥오프' },
        'token-1',
      ),
    ).resolves.toEqual({
      whiteboardDocuments: [documentFixture],
      pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    })

    expect(axiosInstance.get).toHaveBeenCalledWith(LIST_URL, {
      params: { page: 1, limit: 12, search: '킥오프' },
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('공백뿐인 검색어는 쿼리에서 제외한다', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValueOnce({
      data: {
        whiteboardDocuments: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
      },
    })

    await listWhiteboardDocumentsRequest(
      'workspace-1',
      'project-1',
      { page: 1, limit: 12, search: '   ' },
      'token-1',
    )

    expect(axiosInstance.get).toHaveBeenCalledWith(LIST_URL, {
      params: { page: 1, limit: 12 },
      headers: { Authorization: 'Bearer token-1' },
    })
  })

  it('생성 요청은 이름만 보내고 creator 없는 생성 결과를 반환한다', async () => {
    const created: Omit<WhiteboardDocument, 'creator'> = {
      id: documentFixture.id,
      projectId: documentFixture.projectId,
      name: documentFixture.name,
      creatorId: documentFixture.creatorId,
      createdAt: documentFixture.createdAt,
      updatedAt: documentFixture.updatedAt,
    }

    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: { whiteboardDocument: created },
    })

    await expect(
      createWhiteboardDocumentRequest(
        'workspace-1',
        'project-1',
        { name: '킥오프 화이트보드' },
        'token-1',
      ),
    ).resolves.toEqual(created)

    expect(axiosInstance.post).toHaveBeenCalledWith(
      LIST_URL,
      { name: '킥오프 화이트보드' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('이름 변경 요청은 문서 경로로 patch하고 변경 결과만 반환한다', async () => {
    const updated = {
      id: 'document-1',
      name: '킥오프 v2',
      updatedAt: '2026-01-12T04:00:00.000Z',
    }

    vi.mocked(axiosInstance.patch).mockResolvedValueOnce({
      data: { whiteboardDocument: updated },
    })

    await expect(
      updateWhiteboardDocumentRequest(
        'workspace-1',
        'project-1',
        'document-1',
        { name: '킥오프 v2' },
        'token-1',
      ),
    ).resolves.toEqual(updated)

    expect(axiosInstance.patch).toHaveBeenCalledWith(
      `${LIST_URL}/document-1`,
      { name: '킥오프 v2' },
      { headers: { Authorization: 'Bearer token-1' } },
    )
  })

  it('삭제 요청은 문서 경로로 delete한다', async () => {
    vi.mocked(axiosInstance.delete).mockResolvedValueOnce({ data: undefined })

    await deleteWhiteboardDocumentRequest(
      'workspace-1',
      'project-1',
      'document-1',
      'token-1',
    )

    expect(axiosInstance.delete).toHaveBeenCalledWith(
      `${LIST_URL}/document-1`,
      {
        headers: { Authorization: 'Bearer token-1' },
      },
    )
  })
})
