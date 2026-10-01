import type { Meta, StoryObj } from '@storybook/react-vite'

import { Search } from './search'

const meta = {
  title: 'Shared UI/Controls/Search',
  component: Search,
  parameters: { layout: 'centered' },
  args: {
    placeholder: '보드와 문서 검색',
    'aria-label': '보드와 문서 검색',
  },
} satisfies Meta<typeof Search>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filled: Story = {
  args: { defaultValue: '브랜드 가이드' },
}

export const Disabled: Story = {
  args: { placeholder: '검색을 사용할 수 없습니다', disabled: true },
}

export const Wide: Story = {
  args: { className: 'w-96', placeholder: '팀의 모든 콘텐츠 검색' },
}
