import type { Meta, StoryObj } from '@storybook/react-vite'
import { Check } from 'lucide-react'

import { Badge } from './badge'

const meta = {
  title: 'Shared UI/Controls/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  args: { children: '검토 중', semantic: 'neutral' },
  argTypes: {
    semantic: {
      control: 'select',
      options: ['neutral', 'info', 'success', 'warning', 'danger'],
    },
  },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Semantics: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge semantic="neutral">초안</Badge>
      <Badge semantic="info">진행 중</Badge>
      <Badge semantic="success">완료</Badge>
      <Badge semantic="warning">확인 필요</Badge>
      <Badge semantic="danger">차단됨</Badge>
    </div>
  ),
}

export const WithIcon: Story = {
  render: () => (
    <Badge semantic="success">
      <Check /> 승인됨
    </Badge>
  ),
}
