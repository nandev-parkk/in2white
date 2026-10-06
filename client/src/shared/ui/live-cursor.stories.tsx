import type { Meta, StoryObj } from '@storybook/react-vite'

import { LiveCursor } from '@/shared/ui/live-cursor'

const meta = {
  title: 'Shared UI/Compositions/Live Cursor',
  component: LiveCursor,
  parameters: { layout: 'centered' },
  args: { name: '김민지', presenceIndex: 1 },
  argTypes: {
    presenceIndex: { control: { type: 'range', min: 1, max: 6, step: 1 } },
  },
  decorators: [
    (Story) => (
      <div className="border-border-subtle bg-background-default min-h-40 min-w-80 rounded-lg border p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LiveCursor>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LongName: Story = {
  args: { name: '서비스 기획팀 박서연', presenceIndex: 5 },
}

export const PresencePalette: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-x-16 gap-y-10">
      {['김민지', '박서연', '이준호', '최지은', '정도윤', '윤하늘'].map(
        (name, index) => (
          <LiveCursor key={name} name={name} presenceIndex={index + 1} />
        ),
      )}
    </div>
  ),
}
