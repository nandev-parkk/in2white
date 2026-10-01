import { MESSAGES } from '@/shared/constants/messages'

/*
 * 대상 타입은 DB에 문자열로 들어간다. 사전에 없는 값이 와도 빈칸으로 보여주지 않는다 —
 * 새 대상 타입이 백엔드에 먼저 추가돼도 기록을 읽을 수 있어야 한다.
 */
export function targetTypeLabel(targetType: string): string {
  return MESSAGES.auditLog.targetType[targetType] ?? targetType
}
