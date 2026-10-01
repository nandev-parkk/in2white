/** 대시보드 화면 문구. */
export const DASHBOARD_MESSAGES = {
  heading: {
    page: '대시보드',
    trend: '최근 7일 생성 추이',
  },
  metric: {
    users: '사용자',
    workspaces: '워크스페이스',
    projects: '프로젝트',
    whiteboardDocuments: '화이트보드 문서',
  },
  /* 총계만 보면 정지·삭제된 것까지 살아 있는 것으로 읽힌다. 카드에 함께 적는다. */
  detail: {
    deactivated: (count: number) => `정지 ${count}명`,
    deleted: (count: number) => `삭제 ${count}개`,
  },
  trend: {
    column: {
      date: '날짜',
      users: '신규 사용자',
      projects: '신규 프로젝트',
      whiteboardDocuments: '신규 문서',
    },
    empty: '최근 7일 동안 새로 만들어진 것이 없어요',
  },
  error: {
    loadFailed: '대시보드 지표를 불러오지 못했어요',
  },
  a11y: {
    loading: '대시보드 지표 로딩 중',
  },
} as const
