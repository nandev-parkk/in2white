import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from '@/shared/ui/input'

const meta = {
  title: 'Shared UI/Controls/Input',
  component: Input,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    placeholder: '프로젝트 이름을 입력하세요',
    size: 'default',
  },
  argTypes: {
    size: { control: 'select', options: ['default', 'large'] },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="grid gap-3">
      <Input placeholder="기본 크기" size="default" />
      <Input placeholder="큰 크기" size="large" />
    </div>
  ),
}

export const Filled: Story = {
  args: { defaultValue: '신규 서비스 기획', 'aria-label': '프로젝트 이름' },
}

export const Invalid: Story = {
  args: {
    defaultValue: '잘못된 이메일',
    'aria-invalid': true,
    'aria-label': '이메일',
  },
}

export const Disabled: Story = {
  args: { value: '수정할 수 없는 값', disabled: true, readOnly: true },
}
