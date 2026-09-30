import type { Meta, StoryObj } from '@storybook/react-vite'

import { Spinner } from './spinner'

const meta = {
  title: 'Shared UI/Controls/Spinner',
  component: Spinner,
  parameters: { layout: 'centered' },
  args: { size: 'default' },
  argTypes: {
    size: { control: 'select', options: ['default', 'large'] },
  },
} satisfies Meta<typeof Spinner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-5">
      <Spinner size="default" />
      <Spinner size="large" />
    </div>
  ),
}

export const WithLabel: Story = {
  render: () => (
    <div className="text-body text-foreground-secondary flex items-center gap-2">
      <Spinner /> 변경사항을 저장하고 있습니다
    </div>
  ),
}
