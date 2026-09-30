import type { Meta, StoryObj } from '@storybook/react-vite'

import { Skeleton, SkeletonListCell } from './skeleton'

const meta = {
  title: 'Shared UI/Controls/Skeleton',
  component: Skeleton,
  parameters: { layout: 'centered' },
  args: { className: 'h-4 w-48' },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const TextBlock: Story = {
  render: () => (
    <div className="grid w-80 gap-2">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  ),
}

export const ListCell: Story = {
  render: () => (
    <div className="border-border-subtle w-96 overflow-hidden rounded-lg border">
      <SkeletonListCell />
      <SkeletonListCell />
      <SkeletonListCell />
    </div>
  ),
}

export const Card: Story = {
  render: () => (
    <div className="border-border-subtle bg-background-default grid w-72 gap-3 rounded-lg border p-4">
      <Skeleton className="h-36 w-full rounded-md" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
    </div>
  ),
}
