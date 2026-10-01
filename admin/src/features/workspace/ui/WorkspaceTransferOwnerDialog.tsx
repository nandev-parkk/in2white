import { useState } from 'react'

import type { AdminWorkspaceMember } from '@/entities/workspace'
import { MESSAGES } from '@/shared/constants/messages'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@in2white/ui/select'

/*
 * 후보는 현재 멤버로 제한한다. 백엔드가 비멤버를 400으로 막기 때문만이 아니라, 멤버가
 * 아닌 소유자가 생기면 멤버십으로 권한을 보는 제품 경로가 전부 막히기 때문이다.
 * 현재 소유자는 제외한다 — 자기 자신에게 넘기는 요청은 아무것도 바꾸지 않는다.
 */
type WorkspaceTransferOwnerDialogProps = {
  open: boolean
  members: AdminWorkspaceMember[]
  onOpenChange: (open: boolean) => void
  onSubmit: (userId: string) => void
  loading?: boolean
  error?: string
}

function WorkspaceTransferOwnerDialog({
  open,
  members,
  onOpenChange,
  onSubmit,
  loading = false,
  error,
}: WorkspaceTransferOwnerDialogProps) {
  /* 페이지가 열 때마다 새로 마운트한다 — 지난 선택은 남지 않는다. */
  const [selectedUserId, setSelectedUserId] = useState('')

  const candidates = members.filter((member) => member.role !== 'owner')

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-[440px]">
        <DialogTitle>{MESSAGES.workspace.heading.transferOwner}</DialogTitle>
        <DialogDescription>
          {candidates.length === 0
            ? MESSAGES.workspace.empty.transferCandidates
            : MESSAGES.workspace.form.ownerLabel}
        </DialogDescription>

        {candidates.length > 0 && (
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger aria-label={MESSAGES.workspace.form.ownerLabel}>
              <SelectValue
                placeholder={MESSAGES.workspace.form.ownerPlaceholder}
              />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((member) => (
                <SelectItem key={member.userId} value={member.userId}>
                  {MESSAGES.workspace.form.ownerOption(
                    member.name,
                    member.email,
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {error && (
          <p className="text-status-danger text-[12px]" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="tertiary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {MESSAGES.common.action.cancel}
          </Button>
          <Button
            type="button"
            loading={loading}
            disabled={selectedUserId === ''}
            onClick={() => onSubmit(selectedUserId)}
          >
            {MESSAGES.workspace.action.transfer}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { WorkspaceTransferOwnerDialog }
