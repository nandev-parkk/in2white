/** 여러 도메인이 공유하는 입력 검증 문구. */
export const VALIDATION_MESSAGES = {
  emailRequired: '이메일을 입력해주세요',
  emailInvalidFormat: '올바른 이메일 형식이 아닙니다',
  passwordRequired: '비밀번호를 입력해주세요',
  passwordInvalid: '비밀번호를 정확히 입력해주세요',
  passwordTooShort: '비밀번호는 최소 8자 이상이어야 합니다',
  passwordTooLong: '비밀번호는 최대 32자까지 입력 가능합니다',
  passwordMissingLetter: '비밀번호는 영문을 포함해야 합니다',
  passwordMissingNumber: '비밀번호는 숫자를 포함해야 합니다',
  passwordMissingSpecialChar: '비밀번호는 특수문자를 포함해야 합니다',
  passwordConfirmRequired: '비밀번호 확인을 입력해주세요',
  passwordConfirmMismatch: '새 비밀번호가 일치하지 않습니다',
} as const
