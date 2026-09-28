export const MEMBER_MESSAGES = {
  toast: {
    added: '멤버를 추가했어요',
    removed: '멤버를 내보냈어요',
  },
  error: {
    loadFailed: '멤버를 불러오지 못했어요',
    addForbidden: '멤버를 추가할 권한이 없어요',
    addFailed: '멤버를 추가하지 못했어요',
    alreadyMember: '이미 워크스페이스에 있는 멤버예요',
    removeFailed: '멤버를 내보내지 못했어요. 다시 시도해주세요.',
    userLoadFailed: '사용자를 불러오지 못했어요',
  },
  empty: {
    title: '멤버가 없어요',
    noUsers: '추가할 사용자가 없어요',
  },
  form: {
    searchPlaceholder: '이름 또는 이메일로 검색',
    pickerDescription:
      '사용자를 검색하고 선택하면 워크스페이스에 바로 추가해요.',
  },
  action: {
    /** 목록 버튼과 사용자 선택 모달 제목이 같은 문구를 공유한다. */
    add: '멤버 추가',
    remove: '내보내기',
  },
  heading: {
    list: '멤버',
  },
  /** 워크스페이스 역할 배지. */
  role: {
    owner: '소유자',
    member: '멤버',
  },
  label: {
    joinedAt: '합류일',
    alreadyMember: (email: string) => `${email} · 이미 멤버`,
  },
  confirm: {
    removeTitle: (name: string) => `${name}님을 내보낼까요?`,
    removeDescription:
      '내보내면 이 워크스페이스의 프로젝트와 화이트보드 문서에 더 이상 접근할 수 없어요.',
  },
  a11y: {
    search: '멤버 검색',
    invite: '멤버 초대',
    loading: '멤버 불러오는 중',
    list: '멤버 목록',
    remove: (name: string) => `${name} 내보내기`,
    userSearch: '추가할 사용자 검색',
    userLoading: '사용자 불러오는 중',
    userPagination: '사용자 검색 페이지',
  },
} as const
