import { format, formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'

function parseProjectDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatProjectCreatedAt(value: string) {
  const date = parseProjectDate(value)
  return date ? format(date, 'yyyy.MM.dd') : '-'
}

export function formatProjectUpdatedAt(value: string) {
  const date = parseProjectDate(value)
  return date ? formatDistanceToNow(date, { addSuffix: true, locale: ko }) : '-'
}
