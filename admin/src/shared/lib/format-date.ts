/*
 * 어드민은 운영 기록을 읽는 화면이라 상대 시간("3일 전") 대신 절대 날짜를 쓴다.
 * 감사 로그·정지 시점을 다른 로그와 대조할 때 상대 시간은 쓸 수 없다.
 */
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function parseDate(value: string) {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string): string {
  const date = parseDate(value)

  return date ? dateFormatter.format(date) : '-'
}

export function formatDateTime(value: string): string {
  const date = parseDate(value)

  return date ? dateTimeFormatter.format(date) : '-'
}
