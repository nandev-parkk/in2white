/*
 * 쿼리 키를 한곳에 모은다. 멤버를 넣고 빼면 사용자 목록의 워크스페이스 수까지 바뀌므로
 * 한 기능이 다른 기능의 키를 무효화해야 한다 — 키가 기능마다 흩어져 있으면 리터럴을
 * 베껴 쓰다 한쪽만 남는다.
 */
export const QUERY_KEYS = {
  users: ['users'] as const,
  user: (userId: string) => ['user', userId] as const,
  userDeletionImpact: (userId: string) =>
    ['user-deletion-impact', userId] as const,
  memberCandidates: (search: string) =>
    ['users', 'member-candidates', search] as const,
  workspaces: ['workspaces'] as const,
  workspace: (workspaceId: string) => ['workspace', workspaceId] as const,
  projects: ['projects'] as const,
  /** 모든 프로젝트 상세의 공통 접두사. 어느 프로젝트의 문서인지 모를 때 통째로 비운다. */
  projectDetails: ['project'] as const,
  project: (projectId: string) => ['project', projectId] as const,
  whiteboardDocuments: ['whiteboard-documents'] as const,
} as const
