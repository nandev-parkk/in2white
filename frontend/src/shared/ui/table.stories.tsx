import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from '@/shared/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

const MEMBERS = [
  { name: '김민지', role: 'owner', joinedAt: '2026.01.15' },
  { name: '이서준', role: 'member', joinedAt: '2026.02.03' },
  { name: '박하늘', role: 'member', joinedAt: '2026.02.10' },
] as const

const meta = {
  title: 'Shared UI/Compositions/Table',
  component: Table,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-4xl p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Table>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>역할</TableHead>
          <TableHead className="text-right">참여일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {MEMBERS.map((member) => (
          <TableRow key={member.name}>
            <TableCell>{member.name}</TableCell>
            <TableCell>
              <Badge semantic={member.role === 'owner' ? 'info' : 'neutral'}>
                {member.role === 'owner' ? 'Owner' : 'Member'}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{member.joinedAt}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

export const ProjectDocumentList: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>생성자</TableHead>
          <TableHead>생성일</TableHead>
          <TableHead className="text-right">수정일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">2026 브랜드 리뉴얼</TableCell>
          <TableCell>김민지</TableCell>
          <TableCell>2026.01.10</TableCell>
          <TableCell className="text-right">3시간 전</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">고객 여정 지도</TableCell>
          <TableCell>이서준</TableCell>
          <TableCell>2026.02.03</TableCell>
          <TableCell className="text-right">어제</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}

export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>이름</TableHead>
          <TableHead>참여일</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell
            colSpan={2}
            className="text-foreground-secondary py-10 text-center"
          >
            아직 멤버가 없어요
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
}
