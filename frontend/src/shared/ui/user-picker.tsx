import { cn } from 'cn'
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
import { ListCell } from '@/shared/ui/list-cell'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import {
  Pagination,
  PaginationPrevious,
  PaginationNext,
} from '@/shared/ui/pagination'
import type { ComponentProps } from 'react'
import { Button } from '@/shared/ui/button'

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
  onSearchChange: (value: string) => void
  loading?: boolean
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
  title = '멤버 추가',
  users,
  onSelect,
  searchValue,
  onSearchChange,
  loading = false,
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
        className="max-h-[calc(100svh-32px)] w-[calc(100%-32px)] max-w-95 overflow-y-auto p-6 [&>div]:gap-4"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">
          사용자를 검색하고 선택하면 워크스페이스에 바로 추가해요.
        </DialogDescription>
        <Search
          aria-label="추가할 사용자 검색"
          className="w-full"
          maxLength={100}
          disabled={disabled}
          placeholder="이름 또는 이메일로 검색"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div
          data-testid="user-picker-list"
          className="flex max-h-72 flex-col overflow-y-auto"
        >
          {loading ? (
            <div role="status" aria-label="사용자 불러오는 중">
              {Array.from({ length: 5 }, (_, index) => (
                <SkeletonListCell key={index} />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-4 text-center"
            >
              <p className="text-body-small text-status-danger">{error}</p>
              {onRetry && (
                <Button variant="secondary" onClick={onRetry}>
                  다시 시도
                </Button>
              )}
            </div>
          ) : users.length === 0 ? (
            <CompactEmptyState
              icon={<SearchIcon className="size-4" />}
              title={
                searchValue.trim()
                  ? '검색 결과가 없어요'
                  : '추가할 사용자가 없어요'
              }
              description={
                searchValue.trim()
                  ? '다른 검색어로 다시 시도해보세요'
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
                    user.isMember ? `${user.email} · 이미 멤버` : user.email
                  }
                />
              </button>
            ))
          )}
        </div>
        {!loading && !error && totalPages > 1 && (
          <Pagination
            aria-label="사용자 검색 페이지"
            className="justify-center"
          >
            <PaginationPrevious
              disabled={disabled || page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            />
            <span className="text-caption">
              {page} / {totalPages}
            </span>
            <PaginationNext
              disabled={disabled || page >= totalPages}
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
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { UserPicker }
export type { PickableUser }
