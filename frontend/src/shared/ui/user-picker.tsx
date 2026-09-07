import { cn } from 'cn'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Search } from '@/shared/ui/search'
import { ListCell } from '@/shared/ui/list-cell'
import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
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
}

function UserPicker({
  open,
  onOpenChange,
  title = '멤버 추가',
  users,
  onSelect,
  searchValue,
  onSearchChange,
}: UserPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <Search
          placeholder="이름 또는 이메일로 검색"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {users.map((user) => (
            <ListCell
              key={user.id}
              className={cn(user.isMember && 'pointer-events-none opacity-60')}
              leading={
                <Avatar size="default">
                  <AvatarFallback size="default">
                    {user.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              }
              title={user.name}
              subtitle={
                user.isMember ? `${user.email} · 이미 멤버` : user.email
              }
              trailing={<span />}
              onClick={() => !user.isMember && onSelect(user)}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="tertiary" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { UserPicker }
export type { PickableUser }
