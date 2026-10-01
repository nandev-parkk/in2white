/** 워크스페이스 관리 화면 문구. */
export const WORKSPACE_MESSAGES = {
  heading: {
    list: '워크스페이스',
    detail: '워크스페이스 상세',
    edit: '워크스페이스 이름 변경',
    transferOwner: '소유자 이전',
    addMember: '멤버 추가',
    removeMember: '멤버 제거',
    delete: '워크스페이스 삭제',
    basicInfo: '기본 정보',
  },
  tab: {
    members: '멤버',
    projects: '프로젝트',
  },
  column: {
    name: '이름',
    owner: '소유자',
    memberCount: '멤버',
    projectCount: '프로젝트',
    createdAt: '생성일',
    email: '이메일',
    role: '역할',
    status: '상태',
    joinedAt: '참여일',
    creator: '생성자',
    documentCount: '문서',
  },
  role: {
    owner: '소유자',
    member: '멤버',
  },
  status: {
    active: '활성',
    deactivated: '정지',
    deleted: '삭제됨',
  },
  badge: {
    default: '기본',
    alreadyMember: '이미 멤버',
  },
  action: {
    edit: '이름 변경',
    transferOwner: '소유자 이전',
    transfer: '이전',
    addMember: '멤버 추가',
    add: '추가',
    removeMember: '제거',
    delete: '워크스페이스 삭제',
  },
  form: {
    nameLabel: '워크스페이스 이름',
    ownerLabel: '새 소유자',
    ownerPlaceholder: '멤버를 선택하세요',
    ownerOption: (name: string, email: string) => `${name} (${email})`,
    memberSearchLabel: '추가할 사용자 검색',
    memberSearchPlaceholder: '이름 또는 이메일로 검색',
    updateFieldsRequired: '변경할 이름을 입력해주세요',
  },
  search: {
    placeholder: '워크스페이스 또는 소유자로 검색',
  },
  empty: {
    title: '워크스페이스가 없어요',
    description: '사용자가 워크스페이스를 만들면 여기에 표시됩니다',
    members: '멤버가 없어요',
    projects: '프로젝트가 없어요',
    memberCandidates: '추가할 수 있는 사용자가 없어요',
    transferCandidates: '이전할 수 있는 멤버가 없어요',
  },
  detail: {
    defaultNotice:
      '기본 워크스페이스는 이름 변경·멤버 추가·삭제를 할 수 없어요',
    updatedAt: '수정일',
    countSuffix: (count: number) => `${count}개`,
  },
  confirm: {
    removeMember: (email: string) =>
      `${email}을(를) 워크스페이스에서 제거합니다. 이 워크스페이스의 프로젝트와 문서에 접근할 수 없게 됩니다.`,
    delete: (name: string) =>
      `${name}과 하위 프로젝트·화이트보드 문서가 함께 삭제되며 되돌릴 수 없습니다.`,
  },
  validation: {
    nameRequired: '워크스페이스 이름을 입력해주세요',
    nameTooLong: '워크스페이스 이름은 255자 이내로 입력해주세요',
  },
  error: {
    loadFailed: '워크스페이스 목록을 불러오지 못했어요',
    detailLoadFailed: '워크스페이스 정보를 불러오지 못했어요',
    notFound: '워크스페이스를 찾을 수 없어요',
    candidateLoadFailed: '사용자 목록을 불러오지 못했어요',
  },
  a11y: {
    search: '워크스페이스 검색',
    loading: '워크스페이스 목록 로딩 중',
    detailLoading: '워크스페이스 정보 로딩 중',
    candidateLoading: '사용자 검색 중',
    removeMember: (name: string) => `${name} 제거`,
  },
  toast: {
    updated: '워크스페이스 이름을 변경했어요',
    ownerTransferred: '소유자를 이전했어요',
    memberAdded: '멤버를 추가했어요',
    memberRemoved: '멤버를 제거했어요',
    deleted: '워크스페이스를 삭제했어요',
  },
} as const
