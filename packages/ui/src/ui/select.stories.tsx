import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select'

type SelectStoryArgs = ComponentProps<typeof Select> & {
  size?: 'default' | 'large'
}

function SelectExample({
  defaultValue,
  size = 'default',
  ...args
}: SelectStoryArgs) {
  const [value, setValue] = useState(defaultValue)

  return (
    <Select {...args} value={value} onValueChange={setValue}>
      <SelectTrigger size={size} className="w-72" aria-label="담당자 선택">
        <SelectValue placeholder="담당자를 선택하세요" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>디자인팀</SelectLabel>
          <SelectItem value="minji">김민지</SelectItem>
          <SelectItem value="junho">이준호</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>개발팀</SelectLabel>
          <SelectItem value="seoyeon">박서연</SelectItem>
          <SelectItem value="dohyun" disabled>
            최도현 (휴가 중)
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

const meta = {
  title: 'Shared UI/Controls/Select',
  component: Select,
  parameters: { layout: 'centered' },
  args: { size: 'default' },
  argTypes: {
    size: { control: 'select', options: ['default', 'large'] },
  },
  render: (args) => <SelectExample {...args} />,
} satisfies Meta<SelectStoryArgs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Selected: Story = {
  args: { defaultValue: 'minji' },
}

export const Large: Story = {
  args: { defaultValue: 'seoyeon', size: 'large' },
}

export const Disabled: Story = {
  args: { defaultValue: 'junho', disabled: true },
}
