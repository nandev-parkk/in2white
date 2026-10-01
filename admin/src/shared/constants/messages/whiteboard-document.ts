/** 화이트보드 문서 관리 화면 문구. */
export const WHITEBOARD_DOCUMENT_MESSAGES = {
  heading: {
    list: '화이트보드 문서',
    delete: '화이트보드 문서 삭제',
    restore: '화이트보드 문서 복구',
  },
  column: {
    name: '이름',
    project: '프로젝트',
    workspace: '워크스페이스',
    creator: '생성자',
    status: '상태',
    createdAt: '생성일',
    actions: '작업',
  },
  status: {
    active: '활성',
    deleted: '삭제됨',
  },
  filter: {
    label: '삭제 여부',
    all: '전체',
    active: '활성',
    deleted: '삭제됨',
  },
  action: {
    delete: '삭제',
    restore: '복구',
  },
  search: {
    placeholder: '문서 또는 프로젝트로 검색',
  },
  empty: {
    title: '화이트보드 문서가 없어요',
    description: '사용자가 문서를 만들면 여기에 표시됩니다',
  },
  badge: {
    /* 프로젝트가 삭제돼 있으면 문서를 복구해도 제품에서는 보이지 않는다. */
    projectDeleted: '프로젝트 삭제됨',
  },
  confirm: {
    delete: (name: string) =>
      `${name}이(가) 사용자에게 보이지 않게 됩니다. 필요하면 다시 복구할 수 있어요.`,
    restore: (name: string) => `${name}을(를) 다시 사용자에게 보이게 합니다.`,
    restoreUnderDeletedProject: (name: string, projectName: string) =>
      `${name}을(를) 복구하지만 ${projectName}이(가) 삭제된 상태라 사용자에게는 아직 보이지 않아요. 프로젝트도 복구해야 보입니다.`,
  },
  error: {
    loadFailed: '화이트보드 문서 목록을 불러오지 못했어요',
  },
  a11y: {
    search: '화이트보드 문서 검색',
    loading: '화이트보드 문서 목록 로딩 중',
    delete: (name: string) => `${name} 삭제`,
    restore: (name: string) => `${name} 복구`,
  },
  toast: {
    deleted: '화이트보드 문서를 삭제했어요',
    restored: '화이트보드 문서를 복구했어요',
  },
} as const
