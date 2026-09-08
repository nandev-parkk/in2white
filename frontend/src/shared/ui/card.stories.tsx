import type { Meta, StoryObj } from '@storybook/react-vite'
import { Calendar, Clock, Folder, MoreVertical } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/shared/ui/avatar'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card'

const meta = {
  title: 'Shared UI/Compositions/Card',
  component: Card,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-58">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

function ProjectDates({
  createdAtLabel,
  updatedAtLabel,
}: {
  createdAtLabel: string
  updatedAtLabel: string
}) {
  return (
    <CardContent className="gap-1">
      <div className="text-foreground-tertiary flex items-center gap-1.5">
        <Calendar className="size-3.5" />
        <span className="text-caption">생성일 {createdAtLabel}</span>
      </div>
      <div className="text-foreground-tertiary flex items-center gap-1.5">
        <Clock className="size-3.5" />
        <span className="text-caption">수정일 {updatedAtLabel}</span>
      </div>
    </CardContent>
  )
}

function ProjectFooter({ creatorName }: { creatorName: string }) {
  return (
    <CardFooter>
      <Avatar size="small">
        <AvatarFallback size="small">{creatorName.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <span className="text-body-small text-foreground-secondary">
        {creatorName}
      </span>
    </CardFooter>
  )
}

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <Folder className="text-foreground-default size-5" />
        <button
          type="button"
          aria-label="더 보기"
          className="text-foreground-secondary flex size-7 items-center justify-center rounded-md"
        >
          <MoreVertical className="size-4" />
        </button>
      </CardHeader>
      <CardTitle>디자인 워크스페이스</CardTitle>
      <CardDescription>
        프로젝트에 대한 짧은 설명이 여기에 표시돼요
      </CardDescription>
      <ProjectDates createdAtLabel="2026.01.10" updatedAtLabel="3시간 전" />
      <ProjectFooter creatorName="김민지" />
    </Card>
  ),
}

export const WithoutDescription: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <Folder className="text-foreground-default size-5" />
        <button
          type="button"
          aria-label="더 보기"
          className="text-foreground-secondary flex size-7 items-center justify-center rounded-md"
        >
          <MoreVertical className="size-4" />
        </button>
      </CardHeader>
      <CardTitle>브랜드 리뉴얼 프로젝트</CardTitle>
      <ProjectDates createdAtLabel="2026.02.03" updatedAtLabel="어제" />
      <ProjectFooter creatorName="이서준" />
    </Card>
  ),
}

export const WithoutMenu: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <Folder className="text-foreground-default size-5" />
      </CardHeader>
      <CardTitle>고객 인터뷰 아카이브</CardTitle>
      <CardDescription>
        Owner 또는 생성자가 아니면 컨텍스트 메뉴 자체가 렌더링되지 않아요
      </CardDescription>
      <ProjectDates createdAtLabel="2026.03.11" updatedAtLabel="방금 전" />
      <ProjectFooter creatorName="박하늘" />
    </Card>
  ),
}
