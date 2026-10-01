/** 사용자 관리 화면 문구. */
export const USER_MESSAGES = {
  heading: {
    list: '사용자',
    detail: '사용자 상세',
    create: '사용자 추가',
    edit: '사용자 정보 수정',
    resetPassword: '비밀번호 재설정',
    deactivate: '계정 정지',
    reactivate: '정지 해제',
    revokeSessions: '세션 강제 종료',
    delete: '계정 삭제',
    workspaces: '소속 워크스페이스',
    resources: '만든 리소스',
    deletionImpact: '함께 삭제되는 리소스',
  },
  column: {
    name: '이름',
    email: '이메일',
    status: '상태',
    workspaceCount: '워크스페이스',
    createdAt: '가입일',
    role: '역할',
    joinedAt: '참여일',
  },
  status: {
    active: '활성',
    deactivated: '정지',
  },
  filter: {
    label: '정지 여부',
    all: '전체',
    active: '활성',
    deactivated: '정지',
  },
  action: {
    create: '사용자 추가',
    edit: '정보 수정',
    resetPassword: '비밀번호 재설정',
    deactivate: '계정 정지',
    reactivate: '정지 해제',
    revokeSessions: '세션 강제 종료',
    delete: '계정 삭제',
  },
  form: {
    emailLabel: '이메일',
    nameLabel: '이름',
    passwordLabel: '비밀번호',
    newPasswordLabel: '새 비밀번호',
    confirmEmailLabel: '확인용 이메일',
    confirmEmailHint: '삭제하려면 대상 사용자의 이메일을 그대로 입력하세요',
    createDescription: '계정을 만들면 기본 워크스페이스가 함께 생성됩니다',
    updateFieldsRequired: '수정할 내용을 입력해주세요',
  },
  search: {
    placeholder: '이름 또는 이메일로 검색',
  },
  empty: {
    title: '사용자가 없어요',
    description: '사용자를 추가하면 여기에 표시됩니다',
  },
  role: {
    owner: '소유자',
    member: '멤버',
  },
  detail: {
    basicInfo: '기본 정보',
    deactivatedAt: '정지일',
    createdProjects: '만든 프로젝트',
    createdDocuments: '만든 화이트보드 문서',
    defaultWorkspace: '기본',
    noWorkspace: '소속된 워크스페이스가 없어요',
    countSuffix: (count: number) => `${count}개`,
  },
  confirm: {
    resetPassword: (email: string) =>
      `${email} 계정의 비밀번호를 재설정하면 로그인된 모든 기기의 세션이 끊어집니다.`,
    deactivate: (email: string) =>
      `${email} 계정을 정지하면 로그인할 수 없고 모든 세션이 끊어집니다.`,
    reactivate: (email: string) => `${email} 계정의 정지를 해제합니다.`,
    revokeSessions: (email: string) =>
      `${email} 계정의 모든 세션을 끊습니다. 다시 로그인해야 합니다.`,
    delete: (email: string) =>
      `${email} 계정과 아래 리소스가 함께 삭제되며 되돌릴 수 없습니다.`,
  },
  impact: {
    ownedWorkspace: (count: number) => `소유 워크스페이스 ${count}개`,
    otherWorkspaceMembership: (count: number) =>
      `다른 워크스페이스 멤버십 ${count}개`,
    project: (count: number) => `프로젝트 ${count}개`,
    whiteboardDocument: (count: number) => `화이트보드 문서 ${count}개`,
    loading: '삭제 범위를 확인하고 있어요',
  },
  error: {
    loadFailed: '사용자 목록을 불러오지 못했어요',
    detailLoadFailed: '사용자 정보를 불러오지 못했어요',
    notFound: '사용자를 찾을 수 없어요',
  },
  a11y: {
    search: '사용자 검색',
    loading: '사용자 목록 로딩 중',
    detailLoading: '사용자 정보 로딩 중',
  },
  toast: {
    created: '사용자를 추가했어요',
    updated: '사용자 정보를 수정했어요',
    passwordReset: '비밀번호를 재설정했어요',
    deactivated: '계정을 정지했어요',
    reactivated: '계정 정지를 해제했어요',
    sessionsRevoked: '모든 세션을 종료했어요',
    deleted: '계정을 삭제했어요',
  },
} as const
