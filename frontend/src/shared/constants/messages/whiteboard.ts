export const WHITEBOARD_MESSAGES = {
  toast: {
    created: '화이트보드를 만들었어요',
    renamed: '화이트보드 이름을 변경했어요',
    deleted: '화이트보드를 삭제했어요',
    /** PDF 생성은 오래 걸릴 수 있어 진행 중임을 알린다. */
    exportingPdf: 'PDF를 만드는 중이에요',
  },
  error: {
    loadFailed: '화이트보드를 불러오지 못했어요',
    createFailed: '화이트보드를 만들지 못했어요',
    renameFailed: '화이트보드 이름을 변경하지 못했어요',
    deleteFailed: '화이트보드를 삭제하지 못했어요',
    notFound: '화이트보드를 찾을 수 없어요',
    notFoundDescription: '삭제되었거나 접근할 수 없는 화이트보드예요',
    exportEmpty: '내보낼 내용이 없어요',
    exportPdfFailed: 'PDF를 만들지 못했어요',
  },
  empty: {
    title: '아직 화이트보드가 없어요',
    description: '새 화이트보드를 만들어 팀과 함께 아이디어를 그려보세요',
  },
  form: {
    nameRequired: '화이트보드 이름을 입력해주세요',
    nameTooLong: '화이트보드 이름은 50자 이하로 입력해주세요',
    dialogDescription: '화이트보드의 이름을 정해 주세요.',
    namePlaceholder: '예: 킥오프 화이트보드',
    searchPlaceholder: '화이트보드 이름으로 검색',
  },
  action: {
    create: '화이트보드 생성',
    /** 빈 상태 버튼과 생성 모달 제목이 같은 문구를 공유한다. */
    createFirst: '새 화이트보드 만들기',
    rename: '이름 변경',
    backToProject: '프로젝트로 돌아가기',
    exportFile: '파일로 내보내기',
    exportPdf: 'PDF로 내려받기',
    reconnect: '다시 연결',
    discardPending: '미전송 변경 버리기',
  },
  heading: {
    renameDialog: '화이트보드 이름 변경',
    deleteDialog: '화이트보드 삭제',
    /** 문서 이름을 아직 받지 못했을 때 편집기 헤더에 쓴다. */
    fallbackTitle: '화이트보드',
  },
  /** 편집기 헤더 저장 상태 배지 라벨. */
  saveStatus: {
    saved: '저장 완료',
    saving: '저장 중',
    connecting: '연결 중',
    error: '저장 상태 확인 필요',
    disconnected: '동기화가 끊겼어요',
  },
  /** 실시간 동기화 실패 안내. */
  sync: {
    imageTooLarge:
      '이미지가 전송 한도(1 MiB)를 초과했어요. 이미지를 줄여 다시 시도하세요.',
    elementTooLarge: '요소가 전송 한도를 초과했어요.',
    sendFailed: '변경을 전송하지 못했어요.',
    ackFailed:
      '응답을 확인하지 못했어요. 변경은 이 화면에 보관 중입니다. 다시 연결해 주세요.',
    connectFailed: '문서에 연결하지 못했어요. 다시 시도해 주세요.',
    serverUnavailable: '저장 서버에 연결할 수 없어 편집을 잠시 멈췄어요.',
    sessionExpired:
      '로그인이 만료됐어요. 변경을 내보낸 뒤 다시 로그인해 주세요.',
    documentDeleted: '삭제된 화이트보드입니다. 프로젝트로 돌아가 주세요.',
    disconnected:
      '연결이 끊겨 편집을 멈췄어요. 변경은 이 화면에 보관 중입니다.',
  },
  confirm: {
    leaveWithUnsaved:
      '아직 저장되지 않은 변경이 있어요. 내보내지 않고 나갈까요?',
    discardPending:
      '서버가 확인하지 않은 변경을 버리고 서버 장면으로 돌아갈까요?',
  },
  a11y: {
    search: '화이트보드 검색',
    loading: '화이트보드를 불러오는 중',
    viewToggle: '화이트보드 보기 방식',
    editor: '화이트보드 편집기',
    editorLoading: '편집기를 준비하는 중',
    moreActions: '더 보기',
    back: '뒤로 가기',
  },
} as const
