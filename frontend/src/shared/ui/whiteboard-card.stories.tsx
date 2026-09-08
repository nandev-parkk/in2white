import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { WhiteboardCard } from '@/shared/ui/whiteboard-card'

function ActionableCard() {
  const [menuCount, setMenuCount] = useState(0)

  return (
    <div className="flex flex-col items-center gap-4">
      <WhiteboardCard
        title="신규 서비스 사용자 흐름"
        createdAtLabel="2026. 9. 2."
        updatedAtLabel="10분 전"
        creatorName="박서연"
        onMenuClick={() => setMenuCount((count) => count + 1)}
      />
      <p className="text-caption text-foreground-secondary">
        더 보기 클릭 {menuCount}회
      </p>
    </div>
  )
}

const meta = {
  title: 'Shared UI/Compositions/Whiteboard Card',
  component: WhiteboardCard,
  parameters: { layout: 'centered' },
  args: {
    title: '브랜드 리뉴얼 아이디어',
    createdAtLabel: '2026. 8. 28.',
    updatedAtLabel: '오늘 오후 2:30',
    creatorName: '김민지',
  },
} satisfies Meta<typeof WhiteboardCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithMenuAction: Story = {
  render: () => <ActionableCard />,
}

export const LongTitle: Story = {
  args: {
    title: '모바일 앱 온보딩 개선을 위한 사용자 인터뷰 정리',
    createdAtLabel: '2026. 7. 15.',
    updatedAtLabel: '어제',
    creatorName: '최지은',
  },
}

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <WhiteboardCard
        title="3분기 로드맵"
        createdAtLabel="2026. 9. 1."
        updatedAtLabel="방금 전"
        creatorName="이준호"
      />
      <WhiteboardCard
        title="고객 여정 지도"
        createdAtLabel="2026. 8. 20."
        updatedAtLabel="2시간 전"
        creatorName="윤하늘"
      />
    </div>
  ),
}
