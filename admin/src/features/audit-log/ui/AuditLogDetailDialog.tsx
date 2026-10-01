import type { ReactNode } from 'react'

import type { AdminAuditLog } from '@/entities/audit-log'
import { MESSAGES } from '@/shared/constants/messages'
import { formatDateTime } from '@/shared/lib/format-date'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'

import { targetTypeLabel } from '../lib/target-type-label'

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex gap-3">
      <dt className="text-foreground-secondary w-24 shrink-0 text-[14px] leading-[1.429]">
        {label}
      </dt>
      <dd className="text-foreground-default min-w-0 flex-1 text-[14px] leading-[1.429] break-all">
        {children}
      </dd>
    </div>
  )
}

type AuditLogDetailDialogProps = {
  auditLog: AdminAuditLog
  onClose: () => void
}

function AuditLogDetailDialog({
  auditLog,
  onClose,
}: AuditLogDetailDialogProps) {
  const hasMetadata = Object.keys(auditLog.metadata).length > 0

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-[560px]">
        <DialogTitle>{MESSAGES.auditLog.heading.detail}</DialogTitle>
        <DialogDescription>{auditLog.summary}</DialogDescription>

        <dl className="flex flex-col gap-2">
          <DetailRow label={MESSAGES.auditLog.detail.createdAt}>
            {formatDateTime(auditLog.createdAt)}
          </DetailRow>
          <DetailRow label={MESSAGES.auditLog.detail.admin}>
            {`${auditLog.admin.name} (${auditLog.admin.email})`}
          </DetailRow>
          <DetailRow label={MESSAGES.auditLog.detail.action}>
            {auditLog.action}
          </DetailRow>
          <DetailRow label={MESSAGES.auditLog.detail.target}>
            {targetTypeLabel(auditLog.targetType)}
          </DetailRow>
          <DetailRow label={MESSAGES.auditLog.detail.targetId}>
            {auditLog.targetId ?? MESSAGES.auditLog.detail.noValue}
          </DetailRow>
          {/* 요청 정보는 같은 액션이 다른 곳에서 들어왔는지 가릴 때 쓴다. */}
          <DetailRow label={MESSAGES.auditLog.detail.ip}>
            {auditLog.ip ?? MESSAGES.auditLog.detail.noValue}
          </DetailRow>
          <DetailRow label={MESSAGES.auditLog.detail.userAgent}>
            {auditLog.userAgent ?? MESSAGES.auditLog.detail.noValue}
          </DetailRow>
        </dl>

        <section className="flex min-w-0 flex-col gap-2">
          <h3 className="text-foreground-strong text-[14px] leading-[1.429] font-medium">
            {MESSAGES.auditLog.detail.metadata}
          </h3>
          {hasMetadata ? (
            /*
             * 변경 전/후 값을 가공하지 않고 그대로 보여준다. 어드민이 다른 로그와
             * 대조하는 자료라 요약하면 쓸 수 없다. 비밀번호 관련 키는 백엔드가
             * 기록 전에 걸러낸다.
             */
            <pre className="bg-background-subtle text-foreground-default max-h-64 overflow-auto rounded-md p-3 text-[12px] leading-[1.5]">
              {JSON.stringify(auditLog.metadata, null, 2)}
            </pre>
          ) : (
            <p className="text-foreground-secondary text-[14px] leading-[1.429]">
              {MESSAGES.auditLog.detail.noMetadata}
            </p>
          )}
        </section>

        <DialogFooter>
          <Button type="button" variant="tertiary" onClick={onClose}>
            {MESSAGES.common.action.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { AuditLogDetailDialog }
