import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Card, CardDescription, CardTitle } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

function TabsExample({
  defaultValue = 'overview',
  ...args
}: ComponentProps<typeof Tabs>) {
  const [value, setValue] = useState(String(defaultValue))

  return (
    <Tabs {...args} value={value} onValueChange={setValue}>
      <TabsList aria-label="프로젝트 정보">
        <TabsTrigger value="overview">개요</TabsTrigger>
        <TabsTrigger value="activity">활동</TabsTrigger>
        <TabsTrigger value="members">구성원</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <Card>
          <CardTitle>브랜드 리뉴얼</CardTitle>
          <CardDescription>
            브랜드의 시각 언어와 고객 메시지를 새롭게 정리합니다.
          </CardDescription>
        </Card>
      </TabsContent>
      <TabsContent value="activity">
        <Card>
          <CardTitle>최근 활동</CardTitle>
          <CardDescription>
            김민지 님이 무드보드를 12분 전에 수정했습니다.
          </CardDescription>
        </Card>
      </TabsContent>
      <TabsContent value="members">
        <Card>
          <CardTitle>프로젝트 구성원</CardTitle>
          <CardDescription>
            디자인팀과 마케팅팀 8명이 참여 중입니다.
          </CardDescription>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

function TabsWithDisabledItem() {
  const [value, setValue] = useState('documents')

  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList aria-label="워크스페이스 메뉴">
        <TabsTrigger value="documents">문서</TabsTrigger>
        <TabsTrigger value="templates">템플릿</TabsTrigger>
        <TabsTrigger value="archive" disabled>
          보관함
        </TabsTrigger>
      </TabsList>
      <TabsContent value="documents">최근 문서 12개</TabsContent>
      <TabsContent value="templates">사용 가능한 템플릿 6개</TabsContent>
      <TabsContent value="archive">보관된 문서가 없습니다.</TabsContent>
    </Tabs>
  )
}

const meta = {
  title: 'Shared UI/Compositions/Tabs',
  component: Tabs,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[36rem] max-w-[calc(100vw-2rem)]">
        <Story />
      </div>
    ),
  ],
  args: { defaultValue: 'overview' },
  render: (args) => <TabsExample {...args} />,
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InitiallyActivity: Story = {
  args: { defaultValue: 'activity' },
}

export const WithDisabledItem: Story = {
  render: () => <TabsWithDisabledItem />,
}
