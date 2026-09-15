import { format, formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

function parseDate(value: string) {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

export function formatCreatedAt(value: string) {
  const date = parseDate(value)

  return date ? format(date, 'yyyy.MM.dd') : '-'
}

export function formatUpdatedAt(value: string) {
  const date = parseDate(value)

  return date ? formatDistanceToNow(date, { addSuffix: true, locale: ko }) : '-'
}
