/** 감사 로그 화면 문구. */
export const AUDIT_LOG_MESSAGES = {
  heading: {
    list: '감사 로그',
    detail: '감사 로그 상세',
  },
  column: {
    createdAt: '시각',
    admin: '어드민',
    action: '액션',
    target: '대상',
    summary: '요약',
    actions: '작업',
  },
  /* 대상 타입은 DB에 문자열로 들어간다. 사전에 없는 값은 원문을 그대로 보여준다. */
  targetType: {
    user: '사용자',
    workspace: '워크스페이스',
    project: '프로젝트',
    whiteboard_document: '화이트보드 문서',
    admin: '어드민',
  } as Record<string, string>,
  filter: {
    targetTypeLabel: '대상 타입',
    all: '전체',
    from: '시작일',
    to: '종료일',
    admin: (name: string) => `어드민: ${name}`,
    clearAdmin: '어드민 필터 해제',
  },
  search: {
    placeholder: '액션으로 검색 (예: user.update)',
  },
  action: {
    detail: '상세',
  },
  detail: {
    createdAt: '시각',
    admin: '어드민',
    action: '액션',
    target: '대상',
    targetId: '대상 ID',
    summary: '요약',
    ip: 'IP',
    userAgent: 'User-Agent',
    metadata: '변경 내용',
    noMetadata: '남은 변경 내용이 없어요',
    noValue: '-',
  },
  empty: {
    title: '감사 로그가 없어요',
    description: '어드민이 무언가를 바꾸면 여기에 기록됩니다',
    filteredTitle: '조건에 맞는 감사 로그가 없어요',
    filteredDescription: '액션이나 기간 조건을 바꿔보세요',
  },
  error: {
    loadFailed: '감사 로그를 불러오지 못했어요',
  },
  a11y: {
    search: '액션 검색',
    loading: '감사 로그 로딩 중',
    filterByAdmin: (name: string) => `${name} 기록만 보기`,
    detail: (action: string) => `${action} 상세`,
  },
} as const
