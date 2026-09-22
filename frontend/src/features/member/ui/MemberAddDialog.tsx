import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  useAddMember,
  useMemberCandidates,
  isMemberAccessLost,
  memberErrorCode,
} from '../model/use-members'
import { useMemberSearch } from '../model/use-member-search'
import { UserPicker, type PickableUser } from '@/shared/ui/user-picker'
import { toast } from '@/shared/ui/toast'
export function MemberAddDialog({
  accessToken,
  userId,
  workspaceId,
  onClose,
  onAccessLost,
  returnFocus,
}: {
  accessToken: string
  userId: string
  workspaceId: string
  onClose: () => void
  onAccessLost: () => void
  returnFocus?: RefObject<HTMLElement | null>
}) {
  const { search, setSearch, params, setPage } = useMemberSearch()
  const candidates = useMemberCandidates(
    accessToken,
    userId,
    workspaceId,
    params,
    true,
  )
  const add = useAddMember(accessToken, userId, workspaceId)
  const [resultSearch, setResultSearch] = useState(params.search)
  if (!candidates.isPlaceholderData && resultSearch !== params.search) {
    setResultSearch(params.search)
  }
  const submitting = useRef(false)
  const [added, setAdded] = useState<string[]>([])
  const lost =
    isMemberAccessLost(candidates.error) || isMemberAccessLost(add.error)
  useEffect(() => {
    if (lost) onAccessLost()
  }, [lost, onAccessLost])
  async function select(user: PickableUser) {
    if (submitting.current || user.isMember || added.includes(user.id)) return
    submitting.current = true
    try {
      await add.mutateAsync(user.id)
      setAdded((current) => [...current, user.id])
      toast.success('멤버를 추가했어요')
    } catch {
      /* 오류는 모달 안에서 안내한다. */
    } finally {
      submitting.current = false
    }
  }
  return (
    <UserPicker
      open
      onOpenChange={(open) => {
        if (!open && !submitting.current) onClose()
      }}
      users={(candidates.data?.users ?? []).map((user) => ({
        ...user,
        isMember: user.isMember || added.includes(user.id),
      }))}
      onSelect={select}
      searchValue={search}
      resultSearchValue={resultSearch}
      onSearchChange={setSearch}
      loading={candidates.isLoading}
      fetching={candidates.isFetching}
      disabled={add.isPending}
      error={
        candidates.isError
          ? memberErrorCode(candidates.error) === 'MEMBER_SEARCH_FORBIDDEN'
            ? '멤버를 추가할 권한이 없어요'
            : '사용자를 불러오지 못했어요'
          : add.error
            ? memberErrorCode(add.error) === 'MEMBER_ALREADY_EXISTS'
              ? '이미 워크스페이스에 있는 멤버예요'
              : '멤버를 추가하지 못했어요'
            : undefined
      }
      onRetry={() => {
        add.reset()
        void candidates.refetch()
      }}
      page={candidates.data?.pagination.page ?? params.page}
      totalPages={candidates.data?.pagination.totalPages ?? 0}
      onPageChange={setPage}
      onCloseAutoFocus={(event) => {
        if (returnFocus?.current?.isConnected) {
          event.preventDefault()
          returnFocus.current.focus()
        }
      }}
    />
  )
}
