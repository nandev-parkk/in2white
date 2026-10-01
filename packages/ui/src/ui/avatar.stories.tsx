import type { Meta, StoryObj } from '@storybook/react-vite'

import { Avatar, AvatarFallback, AvatarImage } from './avatar'

const PROFILE_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23d9e6ff"/%3E%3Ccircle cx="40" cy="31" r="15" fill="%23f1b99a"/%3E%3Cpath d="M23 29c1-14 10-20 19-20 11 0 18 8 18 21-7-3-13-8-17-14-5 7-11 11-20 13Z" fill="%23343b52"/%3E%3Cpath d="M13 80c2-20 13-30 27-30s25 10 27 30" fill="%235b75d6"/%3E%3C/svg%3E'

const meta = {
  title: 'Shared UI/Controls/Avatar',
  component: Avatar,
  parameters: { layout: 'centered' },
  args: { size: 'default' },
  argTypes: {
    size: { control: 'select', options: ['small', 'default', 'large'] },
  },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarImage src={PROFILE_IMAGE} alt="김민지" />
      <AvatarFallback size={args.size}>김민</AvatarFallback>
    </Avatar>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(['small', 'default', 'large'] as const).map((size) => (
        <Avatar key={size} size={size}>
          <AvatarImage src={PROFILE_IMAGE} alt="김민지" />
          <AvatarFallback size={size}>김민</AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
}

export const Fallback: Story = {
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback size={args.size}>이준</AvatarFallback>
    </Avatar>
  ),
}
