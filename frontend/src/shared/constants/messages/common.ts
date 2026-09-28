/** 여러 도메인이 함께 쓰는 문구. 3곳 이상에서 반복되는 것만 둔다. */
export const COMMON_MESSAGES = {
  error: {
    network: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요',
    retryHint: '잠시 후 다시 시도해보세요',
    unexpected: '문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
  },
  empty: {
    searchTitle: '검색 결과가 없어요',
    searchDescription: '다른 검색어로 다시 시도해보세요',
  },
  action: {
    edit: '수정',
    delete: '삭제',
    cancel: '취소',
    retry: '다시 시도',
    save: '저장',
    create: '만들기',
    clearSearch: '검색 결과 초기화',
    close: '닫기',
    gridView: '카드 보기',
    tableView: '목록 보기',
  },
  label: {
    name: '이름',
    creator: '생성자',
    createdAt: '생성일',
    updatedAt: '수정일',
  },
  confirm: {
    /** 삭제 대상 이름 뒤에 이어 붙는다. */
    deleteSuffix: '을(를) 삭제하면 되돌릴 수 없어요.',
  },
  a11y: {
    rowActions: '작업',
    loading: '로딩 중',
    prevPage: '이전 페이지',
    nextPage: '다음 페이지',
    clearSearchInput: '검색어 지우기',
    showPassword: '비밀번호 표시',
    hidePassword: '비밀번호 숨기기',
    menu: (name: string) => `${name} 메뉴`,
  },
} as const
