import { useMemo, useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/shared/ui/button'
import { UserPicker, type PickableUser } from '@/shared/ui/user-picker'

const USERS: PickableUser[] = [
  {
    id: 'minji',
    name: '김민지',
    email: 'minji.kim@in2white.com',
    isMember: true,
  },
  { id: 'seoyeon', name: '박서연', email: 'seoyeon.park@in2white.com' },
  { id: 'junho', name: '이준호', email: 'junho.lee@in2white.com' },
  { id: 'jieun', name: '최지은', email: 'jieun.choi@in2white.com' },
  {
    id: 'doyun',
    name: '정도윤',
    email: 'doyun.jung@in2white.com',
    isMember: true,
  },
]

type UserPickerStoryProps = Pick<
  ComponentProps<typeof UserPicker>,
  'users' | 'title' | 'open' | 'searchValue'
>

function UserPickerExample({
  users,
  title,
  open: controlledOpen,
  searchValue: controlledSearchValue,
}: UserPickerStoryProps) {
  const [open, setOpen] = useState(controlledOpen)
  const [previousControlledOpen, setPreviousControlledOpen] =
    useState(controlledOpen)
  const [searchValue, setSearchValue] = useState(controlledSearchValue)
  const [previousControlledSearchValue, setPreviousControlledSearchValue] =
    useState(controlledSearchValue)
  const [selectedUser, setSelectedUser] = useState<PickableUser | null>(null)

  if (previousControlledOpen !== controlledOpen) {
    setPreviousControlledOpen(controlledOpen)
    setOpen(controlledOpen)
  }

  if (previousControlledSearchValue !== controlledSearchValue) {
    setPreviousControlledSearchValue(controlledSearchValue)
    setSearchValue(controlledSearchValue)
  }

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLocaleLowerCase('ko-KR')
    if (!query) return users

    return users.filter((user) =>
      `${user.name} ${user.email}`.toLocaleLowerCase('ko-KR').includes(query),
    )
  }, [searchValue, users])

  const handleSelect = (user: PickableUser) => {
    setSelectedUser(user)
    setOpen(false)
  }

  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3">
      <Button onClick={() => setOpen(true)}>멤버 추가</Button>
      <p className="text-body text-foreground-secondary">
        {selectedUser
          ? `${selectedUser.name} 님을 선택했습니다.`
          : '선택한 멤버가 없습니다.'}
      </p>
      <UserPicker
        open={open}
        onOpenChange={setOpen}
        title={title}
        users={filteredUsers}
        onSelect={handleSelect}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
      />
    </div>
  )
}

const meta = {
  title: 'Shared UI/Compositions/User Picker',
  component: UserPicker,
  parameters: { layout: 'centered' },
  args: {
    open: false,
    onOpenChange: () => undefined,
    users: USERS,
    title: '멤버 추가',
    onSelect: () => undefined,
    searchValue: '',
    onSearchChange: () => undefined,
  },
  render: (args) => (
    <UserPickerExample
      users={args.users}
      title={args.title}
      open={args.open}
      searchValue={args.searchValue}
    />
  ),
} satisfies Meta<typeof UserPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  args: { open: true },
}

export const SearchResults: Story = {
  args: { open: true, searchValue: '지은' },
}

export const SelectAndReopen: Story = {
  args: { open: true },
}
