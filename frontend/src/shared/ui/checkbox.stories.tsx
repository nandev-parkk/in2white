import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import { Checkbox } from '@/shared/ui/checkbox'

function CheckboxExample({
  defaultChecked = false,
  ...args
}: ComponentProps<typeof Checkbox>) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <label className="text-body flex cursor-pointer items-center gap-2">
      <Checkbox {...args} checked={checked} onCheckedChange={setChecked} />
      <span>새 소식 이메일로 받기</span>
    </label>
  )
}

const meta = {
  title: 'Shared UI/Controls/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
  args: { defaultChecked: false },
  render: (args) => <CheckboxExample {...args} />,
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Checked: Story = {
  args: { defaultChecked: true },
}

export const States: Story = {
  render: () => (
    <div className="text-body grid gap-3">
      <label className="flex items-center gap-2">
        <Checkbox /> 선택 안 됨
      </label>
      <label className="flex items-center gap-2">
        <Checkbox defaultChecked /> 선택됨
      </label>
      <label className="flex items-center gap-2">
        <Checkbox defaultChecked="indeterminate" /> 일부 선택됨
      </label>
      <label className="text-foreground-disabled flex items-center gap-2">
        <Checkbox disabled /> 선택 불가
      </label>
    </div>
  ),
}
