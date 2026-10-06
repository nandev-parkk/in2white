export const ACCOUNT_MESSAGES = {
  toast: {
    nameUpdated: '이름을 저장했어요',
    passwordUpdated: '비밀번호를 변경했어요',
  },
  error: {
    loadFailed: '계정 정보를 불러오지 못했어요',
  },
  form: {
    nameRequired: '이름을 입력해주세요',
    nameTooLong: '이름은 255자 이내로 입력해주세요',
    idLabel: '아이디',
    currentPasswordLabel: '현재 비밀번호',
    currentPasswordPlaceholder: '현재 비밀번호를 입력해주세요',
    newPasswordLabel: '새 비밀번호',
    newPasswordPlaceholder: '새 비밀번호를 입력해주세요',
    newPasswordConfirmLabel: '새 비밀번호 확인',
    newPasswordConfirmPlaceholder: '새 비밀번호를 다시 입력해주세요',
  },
  action: {
    changePassword: '변경',
  },
  heading: {
    page: '계정 설정',
    profileSection: '기본 정보',
    passwordSection: '비밀번호 변경',
    workspaceSection: '참여 중인 워크스페이스',
  },
} as const
