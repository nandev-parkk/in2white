import type { Meta, StoryObj } from '@storybook/react-vite'

import { Textarea } from './textarea'

const meta = {
  title: 'Shared UI/Controls/Textarea',
  component: Textarea,
  parameters: { layout: 'centered' },
  args: {
    placeholder: '어떤 프로젝트인지 짧게 설명해주세요',
    className: 'w-74',
  },
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Filled: Story = {
  args: {
    defaultValue: '새 브랜드 방향과 핵심 메시지를 정리하는 프로젝트입니다.',
  },
}

export const Disabled: Story = {
  args: { disabled: true },
}
