import { cn } from '@/shared/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Search } from '@/shared/ui/search'
import { Search as SearchIcon } from 'lucide-react'
import { CompactEmptyState } from '@/shared/ui/compact-empty-state'
import { SkeletonListCell } from '@/shared/ui/skeleton'
import { DelayedLoading } from '@/shared/ui/loading-state'
import { ListCell } from '@/shared/ui/list-cell'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import {
  Pagination,
  PaginationPrevious,
  PaginationNext,
} from '@/shared/ui/pagination'
import type { ComponentProps } from 'react'
import { Button } from '@/shared/ui/button'
import { MESSAGES } from '@/shared/constants/messages'

type PickableUser = {
  id: string
  name: string
  email: string
  isMember?: boolean
}

type UserPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  users: PickableUser[]
  onSelect: (user: PickableUser) => void
  searchValue: string
  resultSearchValue?: string
  onSearchChange: (value: string) => void
  loading?: boolean
  fetching?: boolean
  disabled?: boolean
  error?: string
  onRetry?: () => void
  page?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  onCloseAutoFocus?: ComponentProps<typeof DialogContent>['onCloseAutoFocus']
}

function UserPicker({
  open,
  onOpenChange,
  title = MESSAGES.member.action.add,
  users,
  onSelect,
  searchValue,
  resultSearchValue = searchValue,
  onSearchChange,
  loading = false,
  fetching = false,
  disabled = false,
  error,
  onRetry,
  page = 1,
  totalPages = 1,
  onPageChange,
  onCloseAutoFocus,
}: UserPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100svh-32px)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto p-7 [&>div]:gap-4"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <div>
          <DialogTitle className="text-[20px] leading-7 font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-2">
            {MESSAGES.member.form.pickerDescription}
          </DialogDescription>
        </div>
        <Search
          aria-label={MESSAGES.member.a11y.userSearch}
          className="w-full"
          maxLength={100}
          disabled={disabled}
          placeholder={MESSAGES.member.form.searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div
          data-testid="user-picker-list"
          className="flex max-h-72 flex-col overflow-y-auto"
        >
          {loading ? (
            <DelayedLoading>
              <div role="status" aria-label={MESSAGES.member.a11y.userLoading}>
                {Array.from({ length: 5 }, (_, index) => (
                  <SkeletonListCell key={index} />
                ))}
              </div>
            </DelayedLoading>
          ) : error ? (
            <div
              role="alert"
              className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-4 text-center"
            >
              <p className="text-body-small text-status-danger">{error}</p>
              {onRetry && (
                <Button variant="secondary" onClick={onRetry}>
                  {MESSAGES.common.action.retry}
                </Button>
              )}
            </div>
          ) : users.length === 0 ? (
            <CompactEmptyState
              icon={<SearchIcon className="size-4" />}
              title={
                resultSearchValue.trim()
                  ? MESSAGES.common.empty.searchTitle
                  : MESSAGES.member.empty.noUsers
              }
              description={
                resultSearchValue.trim()
                  ? MESSAGES.common.empty.searchDescription
                  : undefined
              }
            />
          ) : (
            users.map((user) => (
              <button
                type="button"
                key={user.id}
                disabled={disabled || user.isMember}
                onClick={() => onSelect(user)}
                className="focus-visible:ring-action-focus-ring rounded-sm text-left outline-none focus-visible:ring-3 disabled:cursor-default disabled:opacity-60"
              >
                <ListCell
                  key={user.id}
                  className={cn(
                    (disabled || user.isMember) && 'cursor-default',
                  )}
                  leading={
                    <Avatar size="default">
                      <AvatarFallback size="default">
                        {user.name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                  }
                  title={user.name}
                  subtitle={
                    user.isMember
                      ? MESSAGES.member.label.alreadyMember(user.email)
                      : user.email
                  }
                />
              </button>
            ))
          )}
        </div>
        {!loading && !error && totalPages > 1 && (
          <Pagination
            aria-label={MESSAGES.member.a11y.userPagination}
            className="justify-center"
          >
            <PaginationPrevious
              disabled={disabled || fetching || page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            />
            <span className="text-caption">
              {page} / {totalPages}
            </span>
            <PaginationNext
              disabled={disabled || fetching || page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            />
          </Pagination>
        )}
        <DialogFooter>
          <Button
            variant="tertiary"
            disabled={disabled}
            onClick={() => onOpenChange(false)}
          >
            {MESSAGES.common.action.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { UserPicker }
export type { PickableUser }
