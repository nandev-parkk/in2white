export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다",
  INVALID_REFRESH_TOKEN: "로그인이 만료되었습니다. 다시 로그인해주세요",
  INVALID_ORIGIN: "허용되지 않은 요청 출처입니다",
  MISSING_BEARER_TOKEN: "인증 토큰이 필요합니다",
  INVALID_ACCESS_TOKEN: "유효하지 않거나 만료된 토큰입니다",
  VALIDATION_ERROR: "잘못된 요청입니다",
  INTERNAL_SERVER_ERROR: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요",
  EMAIL_REQUIRED: "이메일을 입력해주세요",
  EMAIL_INVALID_FORMAT: "올바른 이메일 형식이 아닙니다",
  PASSWORD_REQUIRED: "비밀번호를 입력해주세요",
} as const;
