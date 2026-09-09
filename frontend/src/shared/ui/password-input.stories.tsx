import type { Meta, StoryObj } from '@storybook/react-vite'

import { PasswordInput } from '@/shared/ui/password-input'

const meta = {
  title: 'Shared UI/Controls/PasswordInput',
  component: PasswordInput,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    placeholder: '비밀번호를 입력하세요',
    'aria-label': '비밀번호',
  },
  argTypes: {
    size: { control: 'select', options: ['default', 'large'] },
  },
} satisfies Meta<typeof PasswordInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Large: Story = {
  args: { size: 'large' },
}

export const Filled: Story = {
  args: { defaultValue: 'password123' },
}
