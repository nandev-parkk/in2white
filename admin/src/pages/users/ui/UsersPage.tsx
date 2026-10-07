import { useDocumentTitle } from '@in2white/ui/lib/use-document-title'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Users } from 'lucide-react'

import type {
  AdminUserListItem,
  CreateUserInput,
  UserStatusFilter,
} from '@/entities/user'
import {
  UserCreateDialog,
  UserTable,
  useCreateUser,
  useUsers,
} from '@/features/user'
import { MESSAGES } from '@/shared/constants/messages'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { Button } from '@in2white/ui/button'
import { EmptyState } from '@in2white/ui/empty-state'
import { ErrorState } from '@in2white/ui/error-state'
import { ListPagination } from '@in2white/ui/list-pagination'
import { LoadingState } from '@in2white/ui/loading-state'
import { PageHeader } from '@in2white/ui/page-header'
import { Search } from '@in2white/ui/search'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@in2white/ui/select'
import { toast } from '@in2white/ui/toast'

const USERS_PER_PAGE = 20

const STATUS_OPTIONS: { value: UserStatusFilter; label: string }[] = [
  { value: 'all', label: MESSAGES.user.filter.all },
  { value: 'active', label: MESSAGES.user.filter.active },
  { value: 'deactivated', label: MESSAGES.user.filter.deactivated },
]

function UsersPage() {
  useDocumentTitle('in2white admin | 사용자')

  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<UserStatusFilter>('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)

  const usersQuery = useUsers({ page, limit: USERS_PER_PAGE, search, status })
  const createUser = useCreateUser()

  const users = usersQuery.data?.users ?? []
  const pagination = usersQuery.data?.pagination

  /*
   * 빈 상태 문구는 "방금 받은 응답"의 조건으로 고른다. 입력 즉시 바꾸면 이전 결과가
   * 남아 있는 동안 검색 결과 없음을 먼저 보여주게 된다.
   */
  const [resultSearch, setResultSearch] = useState(search)
  if (!usersQuery.isPlaceholderData && resultSearch !== search) {
    setResultSearch(search)
  }
  const hasSearch = resultSearch.trim().length > 0

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleStatusChange(value: string) {
    setStatus(value as UserStatusFilter)
    setPage(1)
  }

  function openCreateDialog() {
    createUser.reset()
    setCreateOpen(true)
  }

  function handleCreateOpenChange(open: boolean) {
    if (!open && createUser.isPending) return
    if (!open) createUser.reset()
    setCreateOpen(open)
  }

  async function handleCreate(input: CreateUserInput) {
    try {
      await createUser.mutateAsync(input)
      toast.success(MESSAGES.user.toast.created)
      handleCreateOpenChange(false)
    } catch {
      /* 실패 사유는 모달 안에 남긴다. 닫아버리면 입력을 다시 받아야 한다. */
      return
    }
  }

  function handleSelect(user: AdminUserListItem) {
    void navigate({ to: '/users/$userId', params: { userId: user.id } })
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-6">
      <PageHeader
        title={MESSAGES.user.heading.list}
        action={
          <Button className="h-9" onClick={openCreateDialog}>
            {MESSAGES.user.action.create}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Search
          aria-label={MESSAGES.user.a11y.search}
          placeholder={MESSAGES.user.search.placeholder}
          value={search}
          onClear={() => handleSearchChange('')}
          onChange={(event) => handleSearchChange(event.target.value)}
          className="w-full max-w-80"
        />
        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger
            aria-label={MESSAGES.user.filter.label}
            className="w-32"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {usersQuery.isLoading && (
        <LoadingState label={MESSAGES.user.a11y.loading} />
      )}

      {usersQuery.isError && (
        <ErrorState
          className="min-h-48"
          title={MESSAGES.user.error.loadFailed}
          action={
            <Button
              variant="secondary"
              onClick={() => void usersQuery.refetch()}
            >
              {MESSAGES.common.action.retry}
            </Button>
          }
        />
      )}

      {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 && (
        <EmptyState
          className="flex-1 py-8"
          icon={<Users className="size-8" />}
          title={
            hasSearch
              ? MESSAGES.common.empty.searchTitle
              : MESSAGES.user.empty.title
          }
          description={
            hasSearch
              ? MESSAGES.common.empty.searchDescription
              : MESSAGES.user.empty.description
          }
          action={
            hasSearch ? (
              <Button
                variant="secondary"
                onClick={() => handleSearchChange('')}
              >
                {MESSAGES.common.action.clearSearch}
              </Button>
            ) : undefined
          }
        />
      )}

      {!usersQuery.isLoading && !usersQuery.isError && users.length > 0 && (
        <>
          <div className="w-full overflow-x-auto">
            <UserTable users={users} onSelect={handleSelect} />
          </div>
          {pagination && (
            <ListPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              disabled={usersQuery.isFetching}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {createOpen && (
        <UserCreateDialog
          open
          onOpenChange={handleCreateOpenChange}
          onSubmit={handleCreate}
          loading={createUser.isPending}
          error={
            createUser.error ? apiErrorMessage(createUser.error) : undefined
          }
        />
      )}
    </section>
  )
}

export { UsersPage }
