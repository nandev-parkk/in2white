import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/shared/ui/button'
import { CanvasTopBar } from './CanvasTopBar'
import type { PresenceUser } from '@/shared/ui/presence-avatar-stack'

type SaveStatus = ComponentProps<typeof CanvasTopBar>['saveStatus']

const USERS: PresenceUser[] = [
  { id: 'minji', name: '김민지', presenceIndex: 1 },
  { id: 'seoyeon', name: '박서연', presenceIndex: 2 },
  { id: 'junho', name: '이준호', presenceIndex: 3 },
  { id: 'jieun', name: '최지은', presenceIndex: 4 },
  { id: 'doyun', name: '정도윤', presenceIndex: 5 },
]

const SAVE_STATUS_LABELS: Record<NonNullable<SaveStatus>, string> = {
  saved: '저장 완료',
  saving: '저장 중',
  connecting: '연결 중',
  disconnected: '동기화가 끊겼어요',
  error: '저장 상태 확인 필요',
}

function SaveStatusExample({ initialStatus }: { initialStatus: SaveStatus }) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(initialStatus)
  const [lastAction, setLastAction] = useState('선택한 작업이 없습니다.')

  return (
    <div>
      <CanvasTopBar
        title="브랜드 리뉴얼 아이디어"
        saveStatus={saveStatus}
        users={USERS}
        onBack={() => setLastAction('프로젝트 목록으로 이동했습니다.')}
        actions={
          <Button
            variant="secondary"
            onClick={() => setLastAction('공유 링크를 복사했습니다.')}
          >
            공유
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2 p-6">
        {(
          ['saved', 'saving', 'connecting', 'disconnected', 'error'] as const
        ).map((status) => (
          <Button
            key={status}
            variant={saveStatus === status ? 'primary' : 'tertiary'}
            onClick={() => setSaveStatus(status)}
          >
            {SAVE_STATUS_LABELS[status]}
          </Button>
        ))}
        <span className="text-caption text-foreground-secondary ml-2">
          {lastAction}
        </span>
      </div>
    </div>
  )
}

const meta = {
  title: 'Features/Whiteboard Editor/Canvas Top Bar',
  component: CanvasTopBar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="bg-background-canvas min-h-56 w-full">
        <Story />
      </div>
    ),
  ],
  args: { title: '브랜드 리뉴얼 아이디어', saveStatus: 'saved' },
  argTypes: {
    saveStatus: {
      control: 'select',
      options: ['saved', 'saving', 'connecting', 'disconnected', 'error'],
    },
  },
} satisfies Meta<typeof CanvasTopBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const ControlledSaveStatus: Story = {
  render: () => <SaveStatusExample initialStatus="saved" />,
}

export const Saving: Story = {
  args: { saveStatus: 'saving' },
}

export const Connecting: Story = {
  args: { saveStatus: 'connecting' },
}

export const Disconnected: Story = {
  args: { saveStatus: 'disconnected' },
}

export const SaveError: Story = {
  args: { saveStatus: 'error' },
}

export const CollaboratorOverflow: Story = {
  args: { users: USERS },
}
