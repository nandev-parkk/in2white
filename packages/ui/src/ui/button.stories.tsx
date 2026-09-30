import type { Meta, StoryObj } from '@storybook/react-vite'
import { Plus, Save } from 'lucide-react'

import { Button } from './button'

const meta = {
  title: 'Shared UI/Controls/Button',
  component: Button,
  parameters: { layout: 'centered' },
  args: {
    children: '저장하기',
    variant: 'primary',
    size: 'default',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'ghost', 'destructive'],
    },
    size: { control: 'select', options: ['default', 'large'] },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary">새 보드 만들기</Button>
      <Button variant="secondary">초대하기</Button>
      <Button variant="tertiary">미리보기</Button>
      <Button variant="ghost">나중에</Button>
      <Button variant="destructive">삭제하기</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="default">
        <Save /> 저장하기
      </Button>
      <Button size="large">
        <Plus /> 새 프로젝트
      </Button>
    </div>
  ),
}

export const Loading: Story = {
  args: { children: '저장 중', loading: true },
}

export const Disabled: Story = {
  args: { children: '권한이 없습니다', disabled: true },
}
