import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MoreVertical } from 'lucide-react'

import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'

function DropdownExample({ initialOpen = false }: { initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen)
  const [lastAction, setLastAction] = useState('선택한 작업이 없습니다.')

  return (
    <div className="flex flex-col items-center gap-4">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="tertiary" aria-label="프로젝트 카드 메뉴">
            <MoreVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setLastAction('이름 변경 선택')}>
            이름 변경
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setLastAction('설명 변경 선택')}>
            설명 변경
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="danger"
            onSelect={() => setLastAction('프로젝트 삭제 선택')}
          >
            프로젝트 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-caption text-foreground-secondary">{lastAction}</p>
    </div>
  )
}

const meta = {
  title: 'Shared UI/Compositions/Dropdown Menu',
  component: DropdownMenu,
  parameters: { layout: 'centered' },
  render: () => <DropdownExample />,
} satisfies Meta<typeof DropdownMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  render: () => <DropdownExample initialOpen />,
}

export const ItemStates: Story = {
  render: () => <DropdownExample initialOpen />,
}
