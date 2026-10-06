export const WORKSPACE_MESSAGES = {
  toast: {
    created: '워크스페이스를 만들었어요',
    renamed: '워크스페이스 이름을 변경했어요',
    deleted: '워크스페이스를 삭제했어요',
  },
  error: {
    loadFailed: '워크스페이스를 불러오지 못했어요',
    createFailed: '워크스페이스를 만들지 못했어요',
    renameFailed: '워크스페이스 이름을 저장하지 못했어요. 다시 시도해주세요.',
    deleteFailed: '워크스페이스를 삭제하지 못했어요. 다시 시도해주세요.',
    redirectFailed: '워크스페이스로 이동하지 못했어요',
    notFound: '존재하지 않는 워크스페이스예요',
    notFoundDescription: '입력한 워크스페이스를 찾을 수 없어요',
    notAvailable: '이동할 워크스페이스가 없어요',
  },
  form: {
    nameRequired: '워크스페이스 이름을 입력해주세요',
    dialogDescription: '함께 작업할 워크스페이스의 이름을 정해 주세요.',
    namePlaceholder: '예: 마케팅팀',
    nameLabel: '워크스페이스 이름',
    defaultNameLocked: '기본 워크스페이스의 이름은 변경할 수 없어요.',
    /** 계정 설정의 워크스페이스 검색은 placeholder와 aria-label이 같다. */
    searchPlaceholder: '워크스페이스 검색',
  },
  action: {
    create: '새 워크스페이스 만들기',
    createMenuItem: '새 워크스페이스 생성',
    select: '워크스페이스 선택',
    backTo: (name: string) => `${name}로 돌아가기`,
    /** 위험 구역 제목·버튼·확인 모달 제목이 같은 문구를 공유한다. */
    delete: '워크스페이스 삭제',
  },
  empty: {
    title: '워크스페이스가 없습니다',
    none: '워크스페이스 없음',
  },
  heading: {
    settings: '설정',
    generalSection: '일반',
    dangerZone: '위험 구역',
  },
  /** 이름을 아직 받지 못했을 때 사이드바 등에서 쓴다. */
  fallbackName: '기본 워크스페이스',
  confirm: {
    deleteTitle: (name: string) => `${name}를 삭제할까요?`,
    deleteDescription:
      '워크스페이스 안의 모든 프로젝트와 화이트보드 문서가 함께 삭제돼요.',
    deleteIrreversible: '삭제 후에는 복구할 수 없어요.',
    dangerZoneDescription: '워크스페이스와 내부 데이터가 함께 삭제됩니다.',
    deleteScope:
      '프로젝트와 화이트보드 문서를 삭제하고, 이 작업은 되돌릴 수 없어요.',
  },
  a11y: {
    loading: '워크스페이스를 불러오는 중',
    list: '워크스페이스 목록',
    redirecting: '워크스페이스로 이동하는 중',
    redirectingToProject: '프로젝트로 이동하는 중',
    createActions: '워크스페이스 생성 액션',
    deleteConfirm: '워크스페이스 삭제 확인',
  },
} as const
