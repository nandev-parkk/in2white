/** 프로젝트 관리 화면 문구. */
export const PROJECT_MESSAGES = {
  heading: {
    list: '프로젝트',
    basicInfo: '기본 정보',
    documents: '화이트보드 문서',
    delete: '프로젝트 삭제',
    restore: '프로젝트 복구',
  },
  column: {
    name: '이름',
    workspace: '워크스페이스',
    creator: '생성자',
    documentCount: '문서',
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
    placeholder: '프로젝트 또는 워크스페이스로 검색',
  },
  empty: {
    title: '프로젝트가 없어요',
    description: '사용자가 프로젝트를 만들면 여기에 표시됩니다',
    documents: '화이트보드 문서가 없어요',
  },
  detail: {
    description: '설명',
    updatedAt: '수정일',
    noDescription: '설명이 없어요',
    countSuffix: (count: number) => `${count}개`,
    /* 소프트 삭제라 상세 화면에 머무를 수 있다. 복구 버튼이 바로 옆에 있다. */
    deletedNotice: (deletedAt: string) =>
      `${deletedAt}에 삭제되어 사용자에게 보이지 않아요`,
  },
  confirm: {
    /* 워크스페이스·사용자 삭제와 달리 되돌릴 수 있다. 문구에서 그 차이를 드러낸다. */
    delete: (name: string) =>
      `${name}과 하위 화이트보드 문서가 사용자에게 보이지 않게 됩니다. 필요하면 다시 복구할 수 있어요.`,
    restore: (name: string) =>
      `${name}을(를) 다시 사용자에게 보이게 합니다. 개별 삭제된 문서는 삭제 상태로 남아요.`,
  },
  error: {
    loadFailed: '프로젝트 목록을 불러오지 못했어요',
    detailLoadFailed: '프로젝트 정보를 불러오지 못했어요',
    notFound: '프로젝트를 찾을 수 없어요',
  },
  a11y: {
    search: '프로젝트 검색',
    loading: '프로젝트 목록 로딩 중',
    detailLoading: '프로젝트 정보 로딩 중',
    delete: (name: string) => `${name} 삭제`,
    restore: (name: string) => `${name} 복구`,
  },
  toast: {
    deleted: '프로젝트를 삭제했어요',
    restored: '프로젝트를 복구했어요',
  },
} as const
