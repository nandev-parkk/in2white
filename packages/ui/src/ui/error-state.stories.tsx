import type { Meta, StoryObj } from '@storybook/react-vite'
import { WifiOff } from 'lucide-react'

import { Button } from './button'
import { ErrorState } from './error-state'

const meta = {
  title: 'Shared UI/Compositions/Error State',
  component: ErrorState,
  parameters: { layout: 'centered' },
  args: {
    title: '프로젝트를 불러오지 못했어요',
    description: '잠시 후 다시 시도해보세요',
    action: <Button variant="secondary">다시 시도</Button>,
  },
} satisfies Meta<typeof ErrorState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Compact: Story = {
  args: {
    size: 'compact',
    title: '워크스페이스를 불러오지 못했어요',
  },
}

export const CustomIcon: Story = {
  args: {
    icon: <WifiOff className="text-status-danger size-8" />,
    title: '네트워크에 연결할 수 없어요',
    description: '연결 상태를 확인한 뒤 다시 시도해보세요',
  },
}
