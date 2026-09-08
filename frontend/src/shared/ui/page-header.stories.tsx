import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus } from 'lucide-react'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb'
import { Button } from '@/shared/ui/button'
import { PageHeader } from '@/shared/ui/page-header'

const PROJECT_BREADCRUMB = (
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink href="#">프로젝트</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>브랜드 리뉴얼</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
)

const meta = {
  title: 'Shared UI/Compositions/Page Header',
  component: PageHeader,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-5xl p-8">
        <Story />
      </div>
    ),
  ],
  args: { title: '프로젝트' },
} satisfies Meta<typeof PageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAction: Story = {
  args: {
    title: '내 프로젝트',
    action: (
      <Button>
        <Plus /> 새 프로젝트
      </Button>
    ),
  },
}

export const WithBreadcrumb: Story = {
  args: {
    breadcrumb: PROJECT_BREADCRUMB,
    title: '브랜드 리뉴얼',
  },
}

export const Complete: Story = {
  args: {
    breadcrumb: PROJECT_BREADCRUMB,
    title: '브랜드 리뉴얼',
    action: <Button variant="secondary">팀원 초대</Button>,
  },
}
