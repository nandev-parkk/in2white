/** 사이드바·앱 셸 내비게이션 문구. */
export const NAV_MESSAGES = {
  action: {
    logout: '로그아웃',
  },
  a11y: {
    sidebar: '워크스페이스 사이드바',
    expandSidebar: '사이드바 펼치기',
    collapseSidebar: '사이드바 접기',
    resizeSidebar: '사이드바 크기 조절',
    userInfo: (name: string) => `사용자 정보: ${name}`,
  },
} as const
