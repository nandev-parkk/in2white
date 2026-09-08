import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from '@/shared/ui/button'
import { toast, Toaster } from '@/shared/ui/toast'

const meta = {
  title: 'Shared UI/Compositions/Toast',
  component: Toaster,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <>
        <Story />
        <Toaster />
      </>
    ),
  ],
} satisfies Meta<typeof Toaster>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Button onClick={() => toast.success('저장했어요')}>토스트 띄우기</Button>
  ),
}

export const Danger: Story = {
  render: () => (
    <Button
      variant="destructive"
      onClick={() => toast.error('저장에 실패했어요. 다시 시도해 주세요')}
    >
      토스트 띄우기
    </Button>
  ),
}

export const Info: Story = {
  render: () => (
    <Button variant="secondary" onClick={() => toast.info('멤버를 초대했어요')}>
      토스트 띄우기
    </Button>
  ),
}

export const Warning: Story = {
  render: () => (
    <Button
      variant="tertiary"
      onClick={() => toast.warning('네트워크 연결이 불안정해요')}
    >
      토스트 띄우기
    </Button>
  ),
}
