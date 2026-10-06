import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, UserRoundMinus, X } from 'lucide-react'
import type { Member } from '@/entities/member'
import {
  useMembers,
  useRemoveMember,
  isMemberAccessLost,
} from '../model/use-members'
import { useMemberSearch } from '../model/use-member-search'
import { MemberAddDialog } from './MemberAddDialog'
import { Avatar, AvatarFallback } from '@in2white/ui/avatar'
import { Badge } from '@in2white/ui/badge'
import { Button } from '@in2white/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@in2white/ui/dialog'
import { EmptyState } from '@in2white/ui/empty-state'
import { ErrorState } from '@in2white/ui/error-state'
import { ListCell } from '@in2white/ui/list-cell'
import {
  Pagination,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@in2white/ui/pagination'
import { Search } from '@in2white/ui/search'
import { SkeletonListCell } from '@in2white/ui/skeleton'
import { DelayedLoading } from '@in2white/ui/loading-state'
import { toast } from '@in2white/ui/toast'
import { MESSAGES } from '@/shared/constants/messages'

function joinedDate(value: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value))
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join('.')
}
export function MemberListContent({
  loadingStartedAt: initialLoadingStartedAt,
  accessToken,
  userId,
  workspaceId,
  workspaceRole,
  canAddMember = false,
  onAccessLost,
}: {
  loadingStartedAt?: number
  accessToken: string
  userId: string
  workspaceId: string
  workspaceRole?: 'owner' | 'member'
  canAddMember?: boolean
  onAccessLost: () => void
}) {
  const [loadingStartedAt, setLoadingStartedAt] = useState(
    initialLoadingStartedAt,
  )
  const { search, setSearch, params, setPage } = useMemberSearch()
  const query = useMembers(accessToken, userId, workspaceId, params)
  const [resultSearch, setResultSearch] = useState(params.search)
  if (!query.isPlaceholderData && resultSearch !== params.search) {
    setResultSearch(params.search)
  }
  const remove = useRemoveMember(accessToken, userId, workspaceId)
  const [adding, setAdding] = useState(false)
  const [target, setTarget] = useState<Member | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const addButton = useRef<HTMLButtonElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const submitting = useRef(false)
  const owner = workspaceRole === 'owner'
  const canAdd = owner && canAddMember
  const lost =
    isMemberAccessLost(query.error) || isMemberAccessLost(remove.error)
  useEffect(() => {
    if (lost) onAccessLost()
  }, [lost, onAccessLost])
  const totalPages = query.data?.pagination.totalPages ?? 0
  useEffect(() => {
    if (
      query.isSuccess &&
      !query.isPlaceholderData &&
      params.page > Math.max(1, totalPages)
    )
      setPage(Math.max(1, totalPages))
  }, [
    query.isSuccess,
    query.isPlaceholderData,
    params.page,
    totalPages,
    setPage,
  ])
  async function confirm() {
    if (!target || !owner || target.userId === userId || submitting.current)
      return
    submitting.current = true
    try {
      await remove.mutateAsync(target.userId)
      setTarget(null)
      toast.success(MESSAGES.member.toast.removed)
    } catch {
      /* 오류는 확인 모달에서 안내한다. */
    } finally {
      submitting.current = false
    }
  }
  const displayedPage = query.data?.pagination.page ?? params.page
  const firstPage = Math.max(1, Math.min(displayedPage - 2, totalPages - 4))
  return (
    <section className="mx-auto flex w-full max-w-300 min-w-0 flex-col gap-6">
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-heading1 text-foreground-strong outline-none max-sm:pl-3"
      >
        {MESSAGES.member.heading.list}
      </h1>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Search
          aria-label={MESSAGES.member.a11y.search}
          placeholder={MESSAGES.member.form.searchPlaceholder}
          className="w-full max-w-80"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {canAdd && (
          <Button ref={addButton} onClick={() => setAdding(true)}>
            {MESSAGES.member.action.add}
          </Button>
        )}
      </div>
      {query.isLoading ? (
        <DelayedLoading startedAt={loadingStartedAt}>
          <div
            role="status"
            aria-label={MESSAGES.member.a11y.loading}
            className="divide-border-subtle divide-y"
          >
            {Array.from({ length: 5 }, (_, index) => (
              <SkeletonListCell key={index} />
            ))}
          </div>
        </DelayedLoading>
      ) : query.isError ? (
        <ErrorState
          title={MESSAGES.member.error.loadFailed}
          description={MESSAGES.common.error.retryHint}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setLoadingStartedAt(Date.now())
                void query.refetch()
              }}
            >
              {MESSAGES.common.action.retry}
            </Button>
          }
        />
      ) : query.data?.members.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="size-8" />}
          title={
            resultSearch
              ? MESSAGES.common.empty.searchTitle
              : MESSAGES.member.empty.title
          }
          description={MESSAGES.common.empty.searchDescription}
          action={
            resultSearch && (
              <Button variant="secondary" onClick={() => setSearch('')}>
                {MESSAGES.common.action.clearSearch}
              </Button>
            )
          }
        />
      ) : (
        <div
          className="divide-border-subtle divide-y"
          aria-label={MESSAGES.member.a11y.list}
        >
          {query.data?.members.map((member) => (
            <ListCell
              key={member.userId}
              className="min-h-15.5 cursor-default flex-wrap max-sm:[&>div:last-child]:w-full [&>div:nth-child(2)]:min-w-0"
              leading={
                <Avatar>
                  <AvatarFallback>{member.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
              }
              title={member.name}
              subtitle={member.email}
              trailing={
                <div className="flex items-center gap-4 max-sm:mt-2 max-sm:w-full max-sm:justify-end">
                  <Badge
                    semantic={member.role === 'owner' ? 'info' : 'neutral'}
                  >
                    {member.role === 'owner'
                      ? MESSAGES.member.role.owner
                      : MESSAGES.member.role.member}
                  </Badge>
                  <span className="text-caption text-foreground-tertiary whitespace-nowrap">
                    {MESSAGES.member.label.joinedAt}{' '}
                    {joinedDate(member.joinedAt)}
                  </span>
                  {owner &&
                  member.userId !== userId &&
                  member.role !== 'owner' ? (
                    <Button
                      variant="ghost"
                      className="size-7 p-0"
                      aria-label={MESSAGES.member.a11y.remove(member.name)}
                      onClick={(event) => {
                        returnFocus.current = event.currentTarget
                        remove.reset()
                        setTarget(member)
                      }}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : owner ? (
                    <span className="size-7" />
                  ) : null}
                </div>
              }
            />
          ))}
        </div>
      )}
      {!query.isError && totalPages > 1 && (
        <Pagination className="justify-center">
          <PaginationPrevious
            disabled={displayedPage <= 1 || query.isFetching}
            onClick={() => setPage(displayedPage - 1)}
          />
          {Array.from(
            { length: Math.min(5, totalPages) },
            (_, i) => firstPage + i,
          ).map((page) => (
            <PaginationItem
              key={page}
              isActive={displayedPage === page}
              disabled={query.isFetching}
              onClick={() => setPage(page)}
            >
              {page}
            </PaginationItem>
          ))}
          <PaginationNext
            disabled={displayedPage >= totalPages || query.isFetching}
            onClick={() => setPage(displayedPage + 1)}
          />
        </Pagination>
      )}
      {canAdd && adding && (
        <MemberAddDialog
          accessToken={accessToken}
          userId={userId}
          workspaceId={workspaceId}
          onClose={() => setAdding(false)}
          onAccessLost={onAccessLost}
          returnFocus={addButton}
        />
      )}
      <Dialog
        open={owner && Boolean(target)}
        onOpenChange={(open) => {
          if (!open && !submitting.current) setTarget(null)
        }}
      >
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-0 [&>div]:gap-0"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            ;(returnFocus.current?.isConnected
              ? returnFocus.current
              : heading.current
            )?.focus()
          }}
        >
          <div className="flex flex-col px-6 py-7 text-center">
            <span className="bg-status-danger-subtle-bg text-status-danger flex size-12 items-center justify-center self-center rounded-full">
              <UserRoundMinus aria-hidden="true" className="size-6" />
            </span>
            <DialogTitle className="mt-4 text-[20px] leading-7 font-semibold break-words">
              {MESSAGES.member.confirm.removeTitle(target?.name ?? '')}
            </DialogTitle>
            <DialogDescription className="mt-2">
              {MESSAGES.member.confirm.removeDescription}
            </DialogDescription>
            {remove.error && (
              <p role="alert" className="text-caption text-status-danger mt-4">
                {MESSAGES.member.error.removeFailed}
              </p>
            )}
          </div>
          <DialogFooter className="border-border w-full border-t px-6 py-4">
            <Button
              variant="tertiary"
              disabled={remove.isPending}
              onClick={() => setTarget(null)}
            >
              {MESSAGES.common.action.cancel}
            </Button>
            <Button
              variant="destructive"
              loading={remove.isPending}
              onClick={() => void confirm()}
            >
              {MESSAGES.member.action.remove}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
