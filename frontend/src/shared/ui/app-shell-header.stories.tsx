import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { AppShellHeader } from '@/shared/ui/app-shell-header'

const PROFILE_IMAGE =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"%3E%3Crect width="80" height="80" fill="%23e8def8"/%3E%3Ccircle cx="40" cy="30" r="15" fill="%23efb394"/%3E%3Cpath d="M22 30c0-14 8-21 18-21 12 0 19 8 19 22-8-2-15-8-19-14-4 7-10 11-18 13Z" fill="%233d3548"/%3E%3Cpath d="M12 80c2-20 13-30 28-30s26 10 28 30" fill="%23805ad5"/%3E%3C/svg%3E'

function SearchableHeader() {
  const [query, setQuery] = useState('')

  return (
    <div>
      <AppShellHeader
        workspaceName="인투화이트 디자인팀"
        userName="김민지"
        userImageUrl={PROFILE_IMAGE}
        searchPlaceholder="프로젝트 검색"
        onSearchChange={setQuery}
      />
      <div className="text-body text-foreground-secondary p-6">
        검색어:{' '}
        <strong className="text-foreground-strong">{query || '없음'}</strong>
      </div>
    </div>
  )
}

const meta = {
  title: 'Shared UI/Compositions/App Shell Header',
  component: AppShellHeader,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="bg-background-canvas min-h-48 w-full">
        <Story />
      </div>
    ),
  ],
  args: {
    workspaceName: '인투화이트 디자인팀',
    userName: '김민지',
    userImageUrl: PROFILE_IMAGE,
  },
} satisfies Meta<typeof AppShellHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SearchInteraction: Story = {
  render: () => <SearchableHeader />,
}

export const ImageFallback: Story = {
  args: {
    workspaceName: '신규 서비스 TF',
    userName: '박서연',
    userImageUrl: '/없는-프로필.png',
  },
}

export const CustomPlaceholder: Story = {
  args: { searchPlaceholder: '화이트보드 이름으로 검색' },
}
