/** 운영 상태 화면 문구. */
export const SYSTEM_MESSAGES = {
  heading: {
    page: '운영 상태',
    dependencies: '의존성',
    realtime: '실시간 화이트보드',
  },
  dependency: {
    database: '데이터베이스',
    databaseDescription: 'PostgreSQL',
    cache: '캐시',
    cacheDescription: 'Valkey',
    latency: (latencyMs: number) => `${latencyMs}ms`,
  },
  status: {
    up: '정상',
    down: '응답 없음',
  },
  realtime: {
    documents: '열린 문서',
    participants: '참여자',
    sockets: '소켓 연결',
    /* 소켓 서버 없이 HTTP 앱만 띄운 구성에서는 알 수 없다. 0건으로 속이지 않는다. */
    unavailable: '실시간 서버 정보를 읽을 수 없어요',
    unavailableDescription:
      '소켓 서버가 함께 떠 있지 않거나 통계를 읽지 못했어요',
  },
  label: {
    checkedAt: (checkedAt: string) => `${checkedAt} 기준`,
  },
  action: {
    recheck: '다시 점검',
  },
  error: {
    loadFailed: '운영 상태를 불러오지 못했어요',
  },
  a11y: {
    loading: '운영 상태 로딩 중',
  },
} as const
