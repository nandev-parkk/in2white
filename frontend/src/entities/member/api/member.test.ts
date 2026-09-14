import { axiosInstance } from '@/shared/api'
import {
  listMembersRequest,
  listMemberCandidatesRequest,
  addMemberRequest,
  removeMemberRequest,
} from './member'
vi.mock('@/shared/api', () => ({
  axiosInstance: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))
beforeEach(() => vi.clearAllMocks())
it('멤버와 후보 검색에 인증과 정규화된 검색·페이지를 전달한다', async () => {
  const data = {
    members: [],
    pagination: { page: 2, limit: 20, total: 0, totalPages: 0 },
  }
  vi.mocked(axiosInstance.get).mockResolvedValue({ data })
  expect(
    await listMembersRequest(
      'ws',
      { search: ' 민지 ', page: 2, limit: 20 },
      'token',
    ),
  ).toEqual(data)
  expect(axiosInstance.get).toHaveBeenLastCalledWith('/workspaces/ws/members', {
    params: { search: '민지', page: 2, limit: 20 },
    headers: { Authorization: 'Bearer token' },
  })
  await listMemberCandidatesRequest(
    'ws',
    { search: '  ', page: 1, limit: 20 },
    'token',
  )
  expect(axiosInstance.get).toHaveBeenLastCalledWith(
    '/workspaces/ws/member-candidates',
    {
      params: { page: 1, limit: 20 },
      headers: { Authorization: 'Bearer token' },
    },
  )
})
it('추가는 userId를 전송하고 제거는 204 응답을 처리한다', async () => {
  vi.mocked(axiosInstance.post).mockResolvedValue({
    data: { member: { userId: 'u' } },
  })
  vi.mocked(axiosInstance.delete).mockResolvedValue({ status: 204 })
  expect(await addMemberRequest('ws', 'u', 'token')).toEqual({ userId: 'u' })
  expect(axiosInstance.post).toHaveBeenCalledWith(
    '/workspaces/ws/members',
    { userId: 'u' },
    { headers: { Authorization: 'Bearer token' } },
  )
  expect(await removeMemberRequest('ws', 'u', 'token')).toBeUndefined()
  expect(axiosInstance.delete).toHaveBeenCalledWith(
    '/workspaces/ws/members/u',
    { headers: { Authorization: 'Bearer token' } },
  )
})
