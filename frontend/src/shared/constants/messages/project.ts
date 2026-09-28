export const PROJECT_MESSAGES = {
  toast: {
    created: '프로젝트를 만들었어요',
    updated: '프로젝트를 수정했어요',
    deleted: '프로젝트를 삭제했어요',
  },
  error: {
    loadFailed: '프로젝트를 불러오지 못했어요',
    createFailed: '프로젝트를 만들지 못했어요',
    updateFailed: '프로젝트를 수정하지 못했어요',
    deleteFailed: '프로젝트를 삭제하지 못했어요',
    notFound: '프로젝트를 찾을 수 없어요',
    notFoundDescription: '삭제되었거나 접근할 수 없는 프로젝트예요',
  },
  empty: {
    title: '아직 프로젝트가 없어요',
    description: '새 프로젝트를 만들어 팀과 화이트보드로 협업을 시작해보세요',
    noDescription: '설명 없음',
  },
  form: {
    nameRequired: '프로젝트 이름을 입력해주세요',
    nameTooLong: '프로젝트 이름은 50자 이하로 입력해주세요',
    descriptionTooLong: '프로젝트 설명은 200자 이하로 입력해주세요',
    dialogDescription: '프로젝트 이름과 설명을 입력해 주세요.',
    descriptionLabel: '설명',
    /** 선택 입력임을 알리는 접미사. 라벨 뒤에 흐린 색으로 붙는다. */
    optionalSuffix: '(선택)',
    namePlaceholder: '예: 홈페이지 개편',
    descriptionPlaceholder: '프로젝트에 대한 설명을 입력해주세요',
    searchPlaceholder: '프로젝트 이름으로 검색',
  },
  action: {
    create: '프로젝트 생성',
    /** 빈 상태 버튼과 생성 모달 제목이 같은 문구를 공유한다. */
    createFirst: '새 프로젝트 만들기',
    /** 목록으로 돌아가는 버튼과 뒤로 가기 aria-label이 같은 문구를 공유한다. */
    backToList: '프로젝트 목록으로',
  },
  heading: {
    list: '프로젝트',
    editDialog: '프로젝트 수정',
    deleteDialog: '프로젝트 삭제',
  },
  a11y: {
    search: '프로젝트 검색',
    loading: '프로젝트를 불러오는 중',
    viewToggle: '프로젝트 보기 방식',
  },
} as const
