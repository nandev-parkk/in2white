import { useState } from 'react'

import type { AdminWorkspaceMember } from '@/entities/workspace'
import { MESSAGES } from '@/shared/constants/messages'
import { Badge } from '@in2white/ui/badge'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@in2white/ui/dialog'
import { LoadingState } from '@in2white/ui/loading-state'
import { Search } from '@in2white/ui/search'

import { useMemberCandidates } from '../model/use-workspaces'

/*
 * 후보는 전역 사용자 목록에서 검색해 고른다. 이미 멤버인 사용자는 백엔드가 409로 막으므로
 * 고를 수 없게 두어 같은 실수를 반복하지 않게 한다. 정지된 계정은 고를 수 있다 — 어드민은
 * 정지 계정도 멤버로 넣을 수 있고, 정지 여부는 배지로 드러낸다.
 */
type WorkspaceMemberAddDialogProps = {
  open: boolean
  members: AdminWorkspaceMember[]
  onOpenChange: (open: boolean) => void
  onSubmit: (userId: string) => void
  loading?: boolean
  error?: string
}

function WorkspaceMemberAddDialog({
  open,
  members,
  onOpenChange,
  onSubmit,
  loading = false,
  error,
}: WorkspaceMemberAddDialogProps) {
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')

  const candidatesQuery = useMemberCandidates(search, open)
  const candidates = candidatesQuery.data?.users ?? []
  const memberIds = new Set(members.map((member) => member.userId))

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[calc(100%-2rem)] max-w-[480px]">
        <DialogTitle>{MESSAGES.workspace.heading.addMember}</DialogTitle>
        <DialogDescription>
          {MESSAGES.workspace.form.memberSearchLabel}
        </DialogDescription>

        <Search
          aria-label={MESSAGES.workspace.form.memberSearchLabel}
          placeholder={MESSAGES.workspace.form.memberSearchPlaceholder}
          value={search}
          onClear={() => setSearch('')}
          onChange={(event) => setSearch(event.target.value)}
        />

        {candidatesQuery.isLoading && (
          <LoadingState label={MESSAGES.workspace.a11y.candidateLoading} />
        )}

        {candidatesQuery.isError && (
          <p className="text-status-danger text-[12px]" role="alert">
            {MESSAGES.workspace.error.candidateLoadFailed}
          </p>
        )}

        {!candidatesQuery.isLoading &&
          !candidatesQuery.isError &&
          candidates.length === 0 && (
            <p className="text-foreground-secondary text-[14px]">
              {MESSAGES.workspace.empty.memberCandidates}
            </p>
          )}

        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {candidates.map((user) => {
            const alreadyMember = memberIds.has(user.id)

            return (
              <li key={user.id}>
                <button
                  type="button"
                  disabled={alreadyMember}
                  aria-pressed={selectedUserId === user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className="focus-visible:ring-action-focus-ring hover:bg-background-subtle aria-pressed:bg-background-subtle flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-foreground-strong truncate text-[14px] font-medium">
                      {user.name}
                    </span>
                    <span className="text-foreground-secondary truncate text-[12px]">
                      {user.email}
                    </span>
                  </span>
                  {alreadyMember && (
                    <Badge semantic="neutral">
                      {MESSAGES.workspace.badge.alreadyMember}
                    </Badge>
                  )}
                  {!alreadyMember && user.deactivatedAt !== null && (
                    <Badge semantic="danger">
                      {MESSAGES.workspace.status.deactivated}
                    </Badge>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

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
            {MESSAGES.workspace.action.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { WorkspaceMemberAddDialog }
