import type { Meta, StoryObj } from '@storybook/react-vite'
import { Folder, List, Search } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

const meta = {
  title: 'Shared UI/Compositions/Empty State',
  component: EmptyState,
  parameters: { layout: 'centered' },
  args: {
    icon: <Folder className="size-10" />,
    title: '아직 프로젝트가 없습니다',
    description: '첫 프로젝트를 만들고 팀의 아이디어를 한곳에서 정리해 보세요.',
    action: <Button>프로젝트 만들기</Button>,
  },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SearchResult: Story = {
  args: {
    icon: <Search className="size-10" />,
    title: '검색 결과가 없습니다',
    description: '다른 검색어를 입력하거나 필터 조건을 변경해 보세요.',
    action: <Button variant="tertiary">필터 초기화</Button>,
  },
}

export const WithoutAction: Story = {
  args: {
    icon: <List className="size-10" />,
    title: '표시할 문서가 없습니다',
    description: '이 폴더에 문서가 추가되면 여기에 표시됩니다.',
    action: undefined,
  },
}
