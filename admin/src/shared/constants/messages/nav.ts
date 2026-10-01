/** 어드민 앱 셸 내비게이션 문구. */
export const NAV_MESSAGES = {
  menu: {
    dashboard: '대시보드',
    users: '사용자',
    workspaces: '워크스페이스',
  },
  action: {
    logout: '로그아웃',
  },
  a11y: {
    sidebar: '어드민 사이드바',
    /** 배포 환경을 상단바에 표시해 운영/스테이징 혼동을 막는다. */
    environment: (label: string) => `현재 환경: ${label}`,
  },
} as const
