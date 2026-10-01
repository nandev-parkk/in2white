import type { Meta, StoryObj } from '@storybook/react-vite'
import { FileText, MoreVertical } from 'lucide-react'

import { Avatar, AvatarFallback } from './avatar'
import { Badge } from './badge'
import { ListCell } from './list-cell'

const meta = {
  title: 'Shared UI/Compositions/List Cell',
  component: ListCell,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="border-border-subtle w-[28rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border">
        <Story />
      </div>
    ),
  ],
  args: {
    title: '브랜드 가이드 초안',
    subtitle: '김민지 님이 10분 전에 수정',
  },
} satisfies Meta<typeof ListCell>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithLeadingIcon: Story = {
  args: {
    leading: (
      <div className="bg-background-subtle flex size-10 items-center justify-center rounded-md">
        <FileText className="text-foreground-secondary size-5" />
      </div>
    ),
    title: '3분기 캠페인 기획서',
    subtitle: '문서 · 오늘 오전 9:24',
  },
}

export const WithAvatarAndStatus: Story = {
  args: {
    leading: (
      <Avatar>
        <AvatarFallback>서연</AvatarFallback>
      </Avatar>
    ),
    title: '박서연',
    subtitle: '프로덕트 디자이너',
    trailing: <Badge semantic="success">참여 중</Badge>,
  },
}

export const CustomTrailingAction: Story = {
  args: {
    title: '주간 회의록',
    subtitle: '매주 월요일 오전 10시',
    trailing: (
      <button type="button" aria-label="회의록 메뉴" className="p-1">
        <MoreVertical className="size-4" />
      </button>
    ),
  },
}
