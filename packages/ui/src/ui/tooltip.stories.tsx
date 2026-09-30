import type { Meta, StoryObj } from '@storybook/react-vite'
import { Info } from 'lucide-react'

import { Button } from './button'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

const POSITIONS = [
  { side: 'top', label: '위' },
  { side: 'right', label: '오른쪽' },
  { side: 'bottom', label: '아래' },
  { side: 'left', label: '왼쪽' },
] as const

const meta = {
  title: 'Shared UI/Controls/Tooltip',
  component: Tooltip,
  parameters: { layout: 'centered' },
  render: (args) => (
    <Tooltip {...args}>
      <TooltipTrigger asChild>
        <Button variant="tertiary">마우스를 올려보세요</Button>
      </TooltipTrigger>
      <TooltipContent>변경사항을 저장합니다</TooltipContent>
    </Tooltip>
  ),
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Open: Story = {
  args: { defaultOpen: true },
}

export const IconTrigger: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="공개 범위 도움말"
          className="text-foreground-secondary hover:bg-action-secondary focus-visible:ring-action-focus-ring rounded-full p-2 outline-none focus-visible:ring-3"
        >
          <Info className="size-5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">팀원에게만 공개됩니다</TooltipContent>
    </Tooltip>
  ),
}

export const Positions: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-16 p-20">
      {POSITIONS.map(({ side, label }) => (
        <Tooltip key={side} defaultOpen>
          <TooltipTrigger asChild>
            <Button variant="tertiary">{label}</Button>
          </TooltipTrigger>
          <TooltipContent side={side}>툴팁 위치: {label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  ),
}
