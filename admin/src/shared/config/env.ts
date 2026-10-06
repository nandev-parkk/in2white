export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  /* 상단바 배지에 그대로 노출한다. 운영 콘솔에서 스테이징을 조작하는 사고를 막는다. */
  environmentLabel: import.meta.env.VITE_ENVIRONMENT_LABEL ?? 'development',
} as const
