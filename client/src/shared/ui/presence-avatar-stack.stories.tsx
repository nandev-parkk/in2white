import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  PresenceAvatarStack,
  type PresenceUser,
} from '@/shared/ui/presence-avatar-stack'

const PROFILE_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23dce8ff"/%3E%3Ccircle cx="40" cy="31" r="15" fill="%23efb394"/%3E%3Cpath d="M22 29c2-13 10-20 19-20 11 0 18 8 18 21-7-3-12-8-17-14-5 7-11 11-20 13Z" fill="%233a4055"/%3E%3Cpath d="M12 80c3-20 14-30 28-30s25 10 28 30" fill="%235b75d6"/%3E%3C/svg%3E'

const USERS: PresenceUser[] = [
  { id: 'minji', name: '김민지', imageUrl: PROFILE_IMAGE, presenceIndex: 1 },
  { id: 'seoyeon', name: '박서연', presenceIndex: 2 },
  { id: 'junho', name: '이준호', presenceIndex: 3 },
  { id: 'jieun', name: '최지은', presenceIndex: 4 },
  { id: 'doyun', name: '정도윤', presenceIndex: 5 },
  { id: 'haneul', name: '윤하늘', presenceIndex: 6 },
]

const meta = {
  title: 'Shared UI/Compositions/Presence Avatar Stack',
  component: PresenceAvatarStack,
  parameters: { layout: 'centered' },
  args: { users: USERS.slice(0, 3), max: 3, size: 'default' },
  argTypes: {
    size: { control: 'select', options: ['small', 'default'] },
  },
} satisfies Meta<typeof PresenceAvatarStack>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Small: Story = {
  args: { size: 'small' },
}

export const Overflow: Story = {
  args: { users: USERS, max: 3 },
}

export const ImageFallback: Story = {
  args: {
    users: [
      {
        id: 'broken',
        name: '한가람',
        imageUrl: '/없는-프로필.png',
        presenceIndex: 4,
      },
      { id: 'fallback', name: '오수빈', presenceIndex: 6 },
    ],
  },
}
