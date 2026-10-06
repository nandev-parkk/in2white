import { axiosInstance } from '@/shared/api'

export type Member = {
  userId: string
  name: string
  email: string
  role: 'owner' | 'member'
  joinedAt: string
}
export type MemberCandidate = {
  id: string
  name: string
  email: string
  isMember: boolean
}
export type MemberListParams = { search?: string; page: number; limit: number }
export type MemberPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}
export type MemberList = { members: Member[]; pagination: MemberPagination }
export type MemberCandidates = {
  users: MemberCandidate[]
  pagination: MemberPagination
}
const authorization = (token: string) => ({ Authorization: `Bearer ${token}` })
function queryParams(params: MemberListParams) {
  const search = params.search?.trim()
  return {
    page: params.page,
    limit: params.limit,
    ...(search ? { search } : {}),
  }
}
export async function listMembersRequest(
  workspaceId: string,
  params: MemberListParams,
  token: string,
): Promise<MemberList> {
  const { data } = await axiosInstance.get<MemberList>(
    `/workspaces/${workspaceId}/members`,
    { params: queryParams(params), headers: authorization(token) },
  )
  return data
}
export async function listMemberCandidatesRequest(
  workspaceId: string,
  params: MemberListParams,
  token: string,
): Promise<MemberCandidates> {
  const { data } = await axiosInstance.get<MemberCandidates>(
    `/workspaces/${workspaceId}/member-candidates`,
    { params: queryParams(params), headers: authorization(token) },
  )
  return data
}
export async function addMemberRequest(
  workspaceId: string,
  userId: string,
  token: string,
): Promise<Member> {
  const { data } = await axiosInstance.post<{ member: Member }>(
    `/workspaces/${workspaceId}/members`,
    { userId },
    { headers: authorization(token) },
  )
  return data.member
}
export async function removeMemberRequest(
  workspaceId: string,
  userId: string,
  token: string,
): Promise<void> {
  await axiosInstance.delete(`/workspaces/${workspaceId}/members/${userId}`, {
    headers: authorization(token),
  })
}
